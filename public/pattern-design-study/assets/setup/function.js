function cloneMeasurements(measurements) { //parametersList.push(parameters) will cause overwriting. Use this function to avoid overwriting.
    var clone ={};
    for( var key in measurements ){
        if(measurements.hasOwnProperty(key)) //ensure not adding inherited props
            clone[key]=measurements[key]
    }
    return clone
}


function addParametersToList(chartName, parameters){
    let parametersList = JSON.parse(localStorage.getItem(chartName+'parametersList') || '[]')
    parametersList.push(cloneParameters(parameters))
    localStorage.setItem(chartName+'parametersList', JSON.stringify(parametersList))

    let pointer = 0
    if(localStorage.getItem(chartName+'pointer') == null){
        pointer = 0
    }else{
        pointer = Number(localStorage.getItem(chartName+'pointer'))
    }
    pointer = parametersList.length - 1
    localStorage.setItem(chartName+'pointer', pointer)

}