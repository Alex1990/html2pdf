import 'es6-promise/auto';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './jspdf-plugin.js';
import { objType, createElement, cloneNode, unitConvert } from './utils.js';

/**
 * Generate a PDF from an HTML element or string using html2canvas and jsPDF.
 *
 * @param {Element|string} source The source element or HTML string.
 * @param {Object=} opt An object of optional settings: 'margin', 'filename',
 *    'image' ('type' and 'quality'), and 'html2canvas' / 'jspdf', which are
 *    sent as settings to their corresponding functions.
 */
var html2pdf = function(source, opt) {
  // Handle input.
  opt = objType(opt) === 'object' ? opt : {};
  var source = html2pdf.parseInput(source, opt);

  // Determine the PDF page size.
  var pageSize = jsPDF.getPageSize(opt.jsPDF);
  pageSize.inner = {
    width:  pageSize.width - opt.margin[1] - opt.margin[3],
    height: pageSize.height - opt.margin[0] - opt.margin[2]
  };
  pageSize.inner.ratio = pageSize.inner.height / pageSize.inner.width;

  // Copy the source element into a PDF-styled container div.
  var container = html2pdf.makeContainer(source, pageSize);
  var overlay = container.parentElement;

  // Get the locations of all hyperlinks.
  if (opt.enableLinks) {
    // Find all anchor tags and get the container's bounds for reference.
    opt.links = [];
    var links = container.querySelectorAll('a');
    var containerRect = unitConvert(container.getBoundingClientRect(), pageSize.k);

    // Treat each client rect as a separate link (for text-wrapping).
    Array.prototype.forEach.call(links, function(link) {
      var clientRects = link.getClientRects();
      for (var i=0; i<clientRects.length; i++) {
        var clientRect = unitConvert(clientRects[i], pageSize.k);
        clientRect.left -= containerRect.left;
        clientRect.top -= containerRect.top;
        opt.links.push({ el: link, clientRect: clientRect });
      }
    });
  }

  html2pdf.makePDF(container, pageSize, opt);
};

html2pdf.makePDF = function(container, pageSize, opt) {
  var pxFullHeight = container.scrollHeight;
  var pxPageHeight = pageSize.inner.width * pageSize.k / 72 * 96;
  var pageTotal = Math.ceil(pxFullHeight / pxPageHeight);
  var pdf = new jsPDF(opt.jsPDF);
  var count = 0;

  for (var page = 0; page < pageTotal; i++) {
    container.scrollTop = page * pxPageHeight;
    html2canvas(container, opt.html2canvas).then(function (canvas) {
      pdf.addPage();

      var imgData = pageCanvas.toDataURL('image/' + opt.image.type, opt.image.quality);
      pdf.addImage(imgData, opt.image.type, opt.margin[1], opt.margin[0],
        pageSize.inner.width, pageHeight);

      if (opt.enableLinks) {
        var pageTop = page * pageSize.inner.height;
        opt.links.forEach(function(link) {
          if (link.clientRect.top > pageTop && link.clientRect.top < pageTop + pageSize.inner.height) {
            var left = opt.margin[1] + link.clientRect.left;
            var top = opt.margin[0] + link.clientRect.top - pageTop;
            pdf.link(left, top, link.clientRect.width, link.clientRect.height, { url: link.el.href });
          }
        });
      }

      count++;

      if (count === pageTotal) {
        pdf.save(opt.filename);
      }
    });
  }
};

html2pdf.parseInput = function(source, opt) {
  // Parse the opt object.
  opt.jsPDF = opt.jsPDF || {};
  opt.html2canvas = opt.html2canvas || {};
  opt.filename = opt.filename && objType(opt.filename) === 'string' ? opt.filename : 'file.pdf';
  opt.enableLinks = opt.hasOwnProperty('enableLinks') ? opt.enableLinks : true;
  opt.image = opt.image || {};
  opt.image.type = opt.image.type || 'jpeg';
  opt.image.quality = opt.image.quality || 0.95;

  // Parse the margin property of the opt object.
  switch (objType(opt.margin)) {
    case 'undefined':
      opt.margin = 0;
    case 'number':
      opt.margin = [opt.margin, opt.margin, opt.margin, opt.margin];
      break;
    case 'array':
      if (opt.margin.length === 2) {
        opt.margin = [opt.margin[0], opt.margin[1], opt.margin[0], opt.margin[1]];
      }
      if (opt.margin.length === 4) {
        break;
      }
    default:
      throw 'Invalid margin array.';
  }

  // Parse the source element/string.
  if (!source) {
    throw 'Missing source element or string.';
  } else if (objType(source) === 'string') {
    source = createElement('div', { innerHTML: source });
  } else if (objType(source) === 'element') {
    source = cloneNode(source, opt.html2canvas.javascriptEnabled);
  } else {
    throw 'Invalid source - please specify an HTML Element or string.';
  }

  // Return the parsed input (opt is modified in-place, no need to return).
  return source;
};

html2pdf.makeContainer = function(source, pageSize) {
  // Define the CSS styles for the container and its overlay parent.
  var overlayCSS = {
    position: 'fixed',
    overflow: 'hidden',
    zIndex: 1000,
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.8)'
  };
  var containerCSS = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    margin: 'auto',
    width: pageSize.inner.width + pageSize.unit,
    height: pageSize.inner.height + pageSize.unit,
    overflow: 'hidden',
    backgroundColor: 'white'
  };

  // Set the overlay to hidden (could be changed in the future to provide a print preview).
  overlayCSS.opacity = 0;

  // Create and attach the elements.
  var overlay = createElement('div',   { className: 'html2pdf__overlay', style: overlayCSS });
  var container = createElement('div', { className: 'html2pdf__container', style: containerCSS });
  container.appendChild(source);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Enable page-breaks.
  var pageBreaks = source.querySelectorAll('.html2pdf__page-break');
  var pxPageHeight = pageSize.inner.height * pageSize.k / 72 * 96;
  Array.prototype.forEach.call(pageBreaks, function(el) {
    el.style.display = 'block';
    var clientRect = el.getBoundingClientRect();
    el.style.height = pxPageHeight - (clientRect.top % pxPageHeight) + 'px';
  }, this);

  // Return the container.
  return container;
};

// Expose the html2pdf function.
export default html2pdf;
