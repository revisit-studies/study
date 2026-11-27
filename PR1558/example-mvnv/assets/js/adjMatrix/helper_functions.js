
function splitCellNames(name) {
  //remove cell
  let cleanedCellName = name.replace('cell', '');
  let ids = cleanedCellName.split('_');
  return ['cell' + ids[0] + '_' + ids[1], 'cell' + ids[1] + '_' + ids[0]];
}


function searchForNode(theForm) {
    console.log(theForm);
    var reason = '';
    reason += validateName(theForm.name);
    reason += validatePhone(theForm.phone);
    reason += validateEmail(theForm.emaile);

    if (reason != '') {
        alert('Some fields need correction:\n' + reason);
    } else {
        simpleCart.checkout();
    }
    return false;
}
  window.onload = function() {
    console.log(d3.select('#optimalConfig'));
    d3.select('#optimalConfig').on('click', () => {
      console.log('Clicked Optimal!');
      window.controller.tenAttr = false;
      window.controller.fiveAttr = false;
      window.controller.loadConfigs();
    });
    console.log(d3.select('#nodeLinkConfig'));
    d3.select('#nodeLinkConfig').on('click', () => { // 5 attr
      console.log('Clicked 5');
      window.controller.tenAttr = false;
      window.controller.fiveAttr = true;
      window.controller.loadConfigs();
    });

    d3.select('#saturatedConfig').on('click', () => { // 10 attr
      console.log('Clicked 10');
      window.controller.tenAttr = true;
      window.controller.fiveAttr = false;
      window.controller.loadConfigs();
    });
  };
