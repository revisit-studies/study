
// import { MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../../setup/constants.js';
import {getZoom} from '../lib/zoom.js';

const MIN_WINDOW_WIDTH = 1200
const MIN_WINDOW_HEIGHT = 600

function drawDimensionChart() {
  var c = document.getElementById("windowsize");
  var ctx = c.getContext("2d");
  var width = c.width;
  var height = c.height;
  ctx.clearRect(0, 0, width, height);

  // red rectangle
  var rw = Math.floor(width * 0.42);
  var rh = Math.floor(rw * MIN_WINDOW_HEIGHT / MIN_WINDOW_WIDTH);
  var rx0 = Math.floor((width - rw)/2);
  var ry0 = Math.floor((height - rh)/2);
  ctx.strokeStyle = "#990000";
  ctx.fillStyle = "#DD8080";
  ctx.lineWidth = 2;
  ctx.fillRect(rx0, ry0, rw, rh);
  ctx.strokeRect(rx0, ry0, rw, rh);

  // red label
  var dx = Math.floor(width * 0.1);
  var tx = Math.floor(rx0 + rw + dx);
  var ty = Math.floor(ry0 + rh/2);
  ctx.beginPath();
  ctx.moveTo(rx0 + rw, ty);
  ctx.lineTo(tx - 3, ty);
  ctx.stroke();
  var fs = 12;
  ctx.font = fs + "px Arial";
  ctx.fillStyle = "#990000";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Required", tx, ty - fs*0.6);
  ctx.fillText("window size", tx, ty + fs*0.6);

  // white rectangle
  var rw_ = Math.floor(rw * $(window).width() / MIN_WINDOW_WIDTH);
  var rh_ = Math.floor(rh * $(window).height() / MIN_WINDOW_HEIGHT);
  var rx0_ = rx0;
  var ry0_ = ry0;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.fillRect(rx0_, ry0_, rw_, rh_);
  ctx.strokeRect(rx0_, ry0_, rw_, rh_);

  // white label
  var tx_ = Math.floor(rx0 - dx);
  var ty_ = Math.floor(ry0 + rh_/2);
  ctx.beginPath();
  ctx.moveTo(rx0, ty_);
  ctx.lineTo(tx_ + 3, ty_);
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.textAlign = "right";
  ctx.fillText("Your", tx_, ty_ - fs*0.6);
  ctx.fillText("window size", tx_, ty_ + fs*0.6);
}

export function checkWindowDimension() {
  var zoom = getZoom();
  $('#zoomValue').html(Math.trunc(zoom*100));

  $('.content').show();

  if ($(window).width() < MIN_WINDOW_WIDTH || $(window).height() < MIN_WINDOW_HEIGHT) {
    drawDimensionChart();
    $('.content').hide();
    $('#dimension-message').show();
  } else {
    $('#dimension-message').hide();
  }

  if (zoom <= 0.9) {
    $('.content').hide();
    $('#zoom-message').show();
  } else {
    $('#zoom-message').hide();
  }

  //check the browser type.
  if(browserInfo.getBrowserName() != 'Chrome'){

    $('.content').hide();
    $('#browser-message').show();
  }


}
