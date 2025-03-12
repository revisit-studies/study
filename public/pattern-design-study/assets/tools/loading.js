console.log("loading starts");
let _PageHeight = window.innerHeight,
	_PageWidth = window.innerWidth;
// // let _LoadingHtml = `<div id="loadingDiv" style="position: absolute; width: ${_PageWidth}px; height: ${_PageHeight}px; background-color: #ffffff; z-index: 10000; text-align: center; color: #fff; display: inline-block;"><p style="position: relative; top: 40%; bottom: 40%; font: Serif; font-size:${_PageHeight*0.1}pt; "><div class="spinner-border" role="status">
// //   <span class="visually-hidden">Loading...</span>
// // </div></p></div>`;
//
let _LoadingHtml = `<div id="loadingDiv" style="position: absolute; width: ${_PageWidth}px; height: 3000px; background-color: #ffffff; z-index: 10000;"><div class="d-flex justify-content-center" style=" margin-top:${0.5* _PageHeight-50}px">
  <div class="spinner-border text-primary" role="status" style="position: fixed; top:50%; left:50%;">
    <span class="visually-hidden">Loading...</span>
  </div>
</div></div>`

// add loading effect
document.write(_LoadingHtml);

// listen to state change
document.onreadystatechange = completeLoading;

function completeLoading() {
	if (document.readyState == "complete") {
		console.log("loading complete");
        let loadingMask = document.getElementById('loadingDiv');
        loadingMask.parentNode.removeChild(loadingMask);
    }
}
