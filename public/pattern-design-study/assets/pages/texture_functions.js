

/**
 *
 * draw UI elements of tools on the interface
 * draw chart, legend
 * draw UI elements of texture
 * interface functions
 * texture editing functions
 * other
 */

/** draw UI elements of tools on the interface */

function drawDragDropInfo(dragdropID){
    let dragdropDiv = document.getElementById(dragdropID)

    let dragdropPara = document.createElement('p') //drag and drop instruction
    dragdropDiv.appendChild(dragdropPara)
    // dragdropPara.className = 'text-info'
    let dragdropImg = document.createElement('img')
    dragdropPara.appendChild(dragdropImg)
    dragdropImg.src = 'img/icons/drag_drop.png'
    dragdropImg.style.height = '25px'
    dragdropImg.style.margin = '5px'
    dragdropImg.style.display = 'block'


    let dragdropParaText = document.createElement('span')
    dragdropParaText.innerHTML = '<b>drag and drop</b> on textures to switch texture parameters'
    dragdropPara.appendChild(dragdropParaText)
    dragdropPara.style.width = '150px'
    dragdropPara.style.fontSize = '16px';
    // dragdropPara.style.display = 'inline'
    // dragdropPara.style.marginLeft = '100px'
    // dragdropPara.className = 'small-font-size'
    // dragdropPara.style.fontSize = '12px'
}
function drawToolbar(toolbarID){
    let toolbar = document.getElementById(toolbarID)
    appendButtonToToolbar(toolbar,'resetBtn', 'Reset all parameters',filePath+'img/icons/reset.svg')
    appendButtonToToolbar(toolbar,'undoBtn', 'Undo',filePath+'img/icons/undo.svg')
    appendButtonToToolbar(toolbar,'redoBtn', 'Redo', filePath+'img/icons/redo.svg')
    appendButtonToToolbar(toolbar,'dataBtn', 'Change data', filePath+'img/icons/change_data.png')
    appendButtonToToolbar(toolbar,'defaultDataBtn', 'Default data', filePath+'img/icons/default_data.png')

    let fruitIndicatorPara = document.createElement('p')
    toolbar.appendChild(fruitIndicatorPara)
    fruitIndicatorPara.innerHTML = 'Now you are designing texture for <span id="fruitName" style="color:#1E90FF;font-weight: bold"></span>'
    fruitIndicatorPara.style.display = 'inline'
    fruitIndicatorPara.style.marginLeft = '50px'



    /** Buttons in the toolbar */
    dataBtn.onclick = function(){
        localStorage.setItem('defaultData', 0) //0: random data, 1: default data

        //Everytime we reload the window we will reset dataset
        window.location.reload()
    }

    defaultDataBtn.onclick = function(){
        localStorage.setItem('defaultData', 1)//0: random data, 1: default data

        //Everytime we reload the window we will reset dataset
        window.location.reload()
    }

    resetBtn.onclick = function(){
        if(chartName.endsWith('Geo')){
            let defaultBertinTexturesIndex = localStorage.getItem('defaultBertinTexturesIndex')

            parameters = {...parameters, ...bertinTextures[defaultBertinTexturesIndex]} //partly update the parameters object

            for(let i = 0; i < fruits.length; i++){
                geo_getParameters(i)
                geo_setCatPattern(i)
            }

            controlOutline.value = parameters['outline']
            if(controlHalo){
                controlHalo.value = parameters['halo']
            }

            parametersList.push(cloneParameters(parameters))
            localStorage.setItem(chartName+'parametersList', JSON.stringify(parametersList))

        }
        if(chartName.endsWith('Icon')){
            icon_defaultParameters(chartName)
        }

    }

    undoBtn.onclick = function(){
        undo(chartName)
    }

    redoBtn.onclick = function(){
        redo(chartName)
    }

}

function appendButtonToToolbar(toolbar, buttonID, buttonTitle, imgSrc){
    let btn = document.createElement('button')
    btn.id = buttonID
    btn.title = buttonTitle
    btn.className = 'btn btn-outline-secondary'
    let img = document.createElement('img')
    img.src = imgSrc
    btn.appendChild(img)
    toolbar.appendChild(btn)
}

/**
 * Create drop-down list of selecting default geometric texture (Bertin texture sets)
 * @returns {HTMLFormElement}
 */
function drawSelectDefaultGeoTexture(){ //export the node <form>
    let form = document.createElement('form')
    let formText = document.createTextNode('Import default textures')
    form.appendChild(formText)

    let select = document.createElement('select')
    select.id = 'selectDefaultTexture'

    let bertinList = ['bertin150', 'bertin183', 'bertin397','bertin231','bertin333']
    for(let i = 0; i<bertinList.length; i++){
        let opt = document.createElement('option')
        opt.value = i
        opt.innerHTML = bertinList[i]
        // opt.style.backgroundImage = "url('./img/bertinTexture/"+bertinList[i]+".png')"
        // opt.style.backgroundSize = "50px 10px"
        select.appendChild(opt)
    }

    form.appendChild(select)

    //choose different default texture from bertinList and apply to the chart
    select.onchange = function(){
        geo_selectDefaultTexture()
    }

    return form
}

function drawSlider(labelText, id, className, min, max, value, step){//draw a slider
    let slider = document.createElement('div')

    let para = document.createElement('p')
    slider.appendChild(para)

    let paraText = document.createTextNode(labelText)
    para.appendChild(paraText)

    para.className = 'font-weight-bold'

    let input = document.createElement('input')
    slider.appendChild(input)

    input.id = id

    if(className){
        input.className = className
    }

    input.type = 'range'
    input.min = min
    input.max = max
    input.value = value
    input.step = step

    return slider
}

function drawRadios(radiosName, labelList, idList, className, name, vertical){ //vertical: all radios are display in one column
    let div = document.createElement('div')

    let para = document.createElement('p')
    div.appendChild(para)

    let text = document.createTextNode(radiosName)
    para.appendChild(text)

    para.className = 'font-weight-bold'

    let form = document.createElement('form')
    div.appendChild(form)


    for(let i = 0; i<labelList.length;i++){
        //a div to contain one radio (a radio button + a label)
        let div_radio = document.createElement('div')
        form.appendChild(div_radio)

        div_radio.className = 'form-check form-check-inline'
        let input = document.createElement('input')
        div_radio.appendChild(input)

        input.id = idList[i]
        input.className = className + ' form-check-input'
        input.type = 'radio'
        input.name = name
        input.value = i

        let label = document.createElement('label')
        div_radio.appendChild(label)
        label.for = idList[i]
        label.innerHTML = labelList[i]
        label.className = 'form-check-label'

        if(vertical){
            div_radio.classList.remove('form-check-inline')
            // let br = document.createElement('br')
            // form.appendChild(br)
        }
    }

    return div
}

function drawButton(buttonID, buttonClassName, innerHTML){
    let btn = document.createElement('button')
    btn.id = buttonID
    btn.className = buttonClassName
    btn.innerHTML = innerHTML

    return btn
}

function drawSliderWithTicks(labelText, outputID, id, className, min, max, value, step, tickLabelList, radioLabel, radioLabels, radioIDs, radioClassName, radioName){
    let div = document.createElement('div') //main div

    let para = document.createElement('p')
    div.appendChild(para)

    let paraText = document.createTextNode(labelText)
    para.appendChild(paraText)

    para.className = 'font-weight-bold'


    if(outputID){ //if we need to show the value of the slider in an <output>
        let output = document.createElement('output')
        para.appendChild(output)
        output.for = id
        output.id = outputID
        output.style.display="none"
    }


    let sliderDiv = document.createElement('div') //div for input + ticks
    div.appendChild(sliderDiv)
    sliderDiv.style = 'display:inline-grid; grid-template-rows: 1fr 1fr;gap:0px;'

    let inputDiv = document.createElement('div') //div contains input
    sliderDiv.appendChild(inputDiv)
    inputDiv.style = 'display: inline-block;'

    let input = document.createElement('input')
    inputDiv.appendChild(input)
    input.id = id
    if(className){
        input.className = className
    }

    input.type = 'range'
    input.min = min
    input.max = max
    input.value = value
    input.step = step

    let ticksDiv = document.createElement('div')
    sliderDiv.appendChild(ticksDiv)
    ticksDiv.style = 'display: inline-block;'

    let ticksDiv1 = document.createElement('div')
    ticksDiv.appendChild(ticksDiv1)
    ticksDiv1.className = 'sliderticks'

    for(let i = 0; i < tickLabelList.length; i++){
        let majorTick = document.createElement('p')
        ticksDiv1.appendChild(majorTick)
        majorTick.className = 'majorticks'

        let majorLabel = document.createTextNode(tickLabelList[i])
        majorTick.appendChild(majorLabel)

        if(i < tickLabelList.length - 1){
            let minorTick = document.createElement('p')
            ticksDiv1.appendChild(minorTick)
            minorTick.className = 'minorticks'
        }
    }

    let radioDiv = document.createElement('div')
    div.appendChild(radioDiv)

    radioDiv.appendChild(drawRadios(radioLabel, radioLabels, radioIDs, radioClassName, radioName, 1))

    return div
}

function drawCheckbox(checkboxID, checkboxClass, labelText){
    let div = document.createElement('div')
    div.style = 'display:inline-block'
    div.className = 'form-check'
    let input = document.createElement('input')
    div.appendChild(input)
    input.id = checkboxID
    input.className = checkboxClass + ' form-check-input'
    input.type = 'checkbox'

    let label = document.createElement('label')
    div.appendChild(label)
    label.for = checkboxID
    label.innerHTML = labelText
    label.className = 'form-check-label'

    return div
}

/** draw UI elements related to texture (texture, legend, indicators) */
/**
 * Create geometric textures
 * @param e - the dom element we add geoTextures to
 * @param data - the data for creating geoTextures
 * @returns {*} - <def>
 */
function drawChartDiv(chartDivID, width, height, chart){
    //create div structure
    let chartContainerDiv = document. createElement('div')
    $('#'+chartDivID).append(chartContainerDiv)
    chartContainerDiv.style.position = 'relative'

    // if(chartName.endsWith('Geo')){
    let chartSvgDivA = document.createElement('div')
    chartContainerDiv.appendChild(chartSvgDivA)
    chartSvgDivA.style.position = 'absolute'

    let chartSvgA = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    chartSvgDivA.appendChild(chartSvgA)
    chartSvgA.setAttribute('id', chart+'A')
    chartSvgA.setAttribute('width', width)
    chartSvgA.setAttribute('height', height)
    // }


    let chartSvgDiv = document.createElement('div')
    chartContainerDiv.appendChild(chartSvgDiv)
    chartSvgDiv.style.position = 'absolute'

    let chartSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    chartSvgDiv.appendChild(chartSvg)
    chartSvg.setAttribute('id', chart)
    chartSvg.setAttribute('width', width)
    chartSvg.setAttribute('height', height)

    // if(chartName.startsWith('pie') || chartName.startsWith('map')){
    let chartSvgDivWhiteStroke = document.createElement('div')
    chartContainerDiv.appendChild(chartSvgDivWhiteStroke)
    chartSvgDivWhiteStroke.style.position = 'absolute'
    chartSvgDivWhiteStroke.style.pointerEvents = "none"

    let chartSvgWhiteStroke = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    chartSvgDivWhiteStroke.appendChild(chartSvgWhiteStroke)
    chartSvgWhiteStroke.setAttribute('id', chart+'WhiteStroke')
    chartSvgWhiteStroke.setAttribute('width', width)
    chartSvgWhiteStroke.setAttribute('height', height)

    let chartSvgDivBlackStroke = document.createElement('div')
    chartContainerDiv.appendChild(chartSvgDivBlackStroke)
    chartSvgDivBlackStroke.style.position = 'absolute'
    chartSvgDivBlackStroke.style.pointerEvents = "none"

    let chartSvgBlackStroke = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    chartSvgDivBlackStroke.appendChild(chartSvgBlackStroke)
    chartSvgBlackStroke.setAttribute('id', chart+'BlackStroke')
    chartSvgBlackStroke.setAttribute('width', width)
    chartSvgBlackStroke.setAttribute('height', height)
    // }
}

function geoTextures(e,data){
    let defs = e.append('defs')
    let linePattern = defs.selectAll(".linePattern")
        .data(data)
        .enter()
        .append("pattern")
        .attr("id", (_, i) => `linePattern${i}`)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 40)
        .attr("height", 40)
        .attr('patternTransform', 'translate(0,0) rotate(0)')

    linePattern.append('rect')
        .attr("id", (_, i) => "linePattern"+i+"Background")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 40)
        .attr("height", 40)
        .attr("stroke-width", 0)
        .attr("fill", "white")

    linePattern.append('path')
        .attr('id', (_, i) =>'linePattern'+i+'Line0')
        .attr('d','m -100 0 l 200 0')
        .attr("stroke-width", '1px')
        .attr('stroke','black')

    let dotPattern = defs.selectAll(".dotPattern")
        .data(data)
        .enter()
        .append("pattern")
        .attr("id", (_, i) => `dotPattern${i}`)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 40)
        .attr("height", 40)
        .attr('patternTransform', 'translate(0,0) rotate(0)')

    dotPattern.append('rect')
        .attr("id", (_, i) => "dotPattern"+i+"Background")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 40)
        .attr("height", 40)
        .attr("stroke-width", 0)
        .attr("fill", "white")

    dotPattern.append('circle')
        .attr('id', (_, i) =>'dotPattern'+i+'Circle0')
        .attr('cx', '20px')
        .attr('cy', '20px')
        .attr('r', '5px')

    let gridPatternA = defs.selectAll(".gridPatternA")
        .data(data)
        .enter()
        .append("pattern")
        .attr("id", (_, i) => `gridPatternA${i}`)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 40)
        .attr("height", 40)
        .attr('patternTransform', 'translate(0,0) rotate(0)')

    gridPatternA.append('rect')
        .attr("id", (_, i) => "gridPattern"+i+"Background")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 40)
        .attr("height", 40)
        .attr("stroke-width", 0)
        .attr("fill", "white")

    gridPatternA.append('path')
        .attr('id', (_, i) =>'gridPatternA'+i+'Line0')
        .attr('d','m -100 0 l 200 0')
        .attr("stroke-width", '1px')
        .attr('stroke','black')

    let gridPattern = defs.selectAll(".gridPattern")
        .data(data)
        .enter()
        .append("pattern")
        .attr("id", (_, i) => `gridPattern${i}`)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 40)
        .attr("height", 40)
        .attr('patternTransform', 'translate(0,0) rotate(0)')


    gridPattern.append('path')
        .attr('id', (_, i) =>'gridPattern'+i+'Line0')
        .attr('d','m -100 0 l 200 0')
        .attr("stroke-width", '1px')
        .attr('stroke','black')

    return defs
}
//create geo texture based on parameters
function para_geoTextures(e, data, parameters, textureID){//textureID: when we need several sets of geo texture, we use this textureID to distinguish them
    let defs = e.append('defs')
    let linePattern = defs.selectAll(".linePattern")
        .data(data)
        .enter()
        .append("pattern")
        .attr("id", (_, i) => textureID+'_linePattern'+i) //para refers this pattern is created from parameters
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", function (d,i){
            return parameters['linePattern'+i+'Density']
        })
        .attr("height", function (d,i){
            return parameters['linePattern'+i+'Density']
        })
        .attr('patternTransform', function (d,i){
            let x = parameters['linePattern'+i+'X']
            let y = parameters['linePattern'+i+'Y']
            let degree = parameters['linePattern'+i+'Rotate']

            return 'translate('+x+','+y+') rotate('+degree+')'
        })

    linePattern.append('rect')
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 40)
        .attr("height", 40)
        .attr("stroke-width", 0)
        .attr("fill", function (d,i){
            if(parameters['linePattern'+i+'Background'] == 0){
                return 'white'
            }
            if(parameters['linePattern'+i+'Background'] == 1){
                return 'black'
            }
        })

    linePattern.append('path')
        .attr('d','m -100 0 l 200 0')
        .attr("stroke-width", function (d,i){
            return parameters['linePattern'+i+'StrokeWidth']
        })
        .attr('stroke',function (d,i){
            if(parameters['linePattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['linePattern'+i+'Background'] == 1){
                return 'white'
            }
        })
        .attr('transform',  (_, i) => 'translate(0,'+0.5*parameters['linePattern'+i+'Density']+')')

    let dotPattern = defs.selectAll(".dotPattern")
        .data(data)
        .enter()
        .append("pattern")
        .attr("id", (_, i) => textureID+'_dotPattern'+i)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", function (d,i){
            return parameters['dotPattern'+i+'Density']
        })
        .attr("height", function (d,i){
            return parameters['dotPattern'+i+'Density']
        })
        .attr('patternTransform', function (d,i){
            let x = parameters['dotPattern'+i+'X']
            let y = parameters['dotPattern'+i+'Y']
            let degree = parameters['dotPattern'+i+'Rotate']

            return 'translate('+x+','+y+') rotate('+degree+')'
        })

    dotPattern.append('rect')
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 40)
        .attr("height", 40)
        .attr("stroke-width", 0)
        .attr("fill", function (d,i){
            if(parameters['dotPattern'+i+'Background'] == 0){
                return 'white'
            }
            if(parameters['dotPattern'+i+'Background'] == 1){
                return 'black'
            }
        })

    dotPattern.append('circle')
        .attr('cx', function (d,i){
            return 0.5*parameters['dotPattern'+i+'Density']
        })
        .attr('cy', function (d,i){
            return 0.5*parameters['dotPattern'+i+'Density']
        })
        .attr('r', function (d,i){
            return parameters['dotPattern'+i+'Size']
        })
        .attr('stroke-width', function (d,i){
            return parameters['dotPattern'+i+'PrimitiveStrokeWidth']
        })
        .attr('fill-opacity', function (d,i){
            if(parameters['dotPattern'+i+'Primitive'] == 0){
                return 1
            }
            if(parameters['dotPattern'+i+'Primitive'] == 1){
                return 0
            }
        })
        .attr('stroke-opacity', function (d,i){
            if(parameters['dotPattern'+i+'Primitive'] == 0){
                return 0
            }
            if(parameters['dotPattern'+i+'Primitive'] == 1){
                return 1
            }
        })
        .attr('fill', function (d,i){
            if(parameters['dotPattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['dotPattern'+i+'Background'] == 1){
                return 'white'
            }
        })
        .attr('stroke', function (d,i){
            if(parameters['dotPattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['dotPattern'+i+'Background'] == 1){
                return 'white'
            }
        })


    let gridPatternA = defs.selectAll(".gridPatternA")
        .data(data)
        .enter()
        .append("pattern")
        .attr("id", (_, i) => textureID+'_gridPatternA'+i)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", (_, i) => parameters['gridPattern'+i+'Density'])
        .attr("height", (_, i) => parameters['gridPattern'+i+'Density'])
        .attr('patternTransform', function (d,i){
            let x = parameters['gridPattern'+i+'X']
            let y = parameters['gridPattern'+i+'Y']
            let degree = 180 - parseFloat(parameters['gridPattern'+i+'Angle']) + parseFloat(parameters['gridPattern'+i+'Rotate'])

            return 'translate('+x+','+y+') rotate('+degree+')'
        })

    gridPatternA.append('rect')
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 40)
        .attr("height", 40)
        .attr("stroke-width", 0)
        .attr("fill", function (d,i){
            if(parameters['gridPattern'+i+'Background'] == 0){
                return 'white'
            }
            if(parameters['gridPattern'+i+'Background'] == 1){
                return 'black'
            }
        })

    gridPatternA.append('path')
        .attr('d','m -100 0 l 200 0')
        .attr("stroke-width", (_, i) => parameters['gridPattern'+i+'StrokeWidth'])
        .attr('stroke',function (d,i){
            if(parameters['gridPattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['gridPattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    let gridPattern = defs.selectAll(".gridPattern")
        .data(data)
        .enter()
        .append("pattern")
        .attr("id", (_, i) => textureID+'_gridPattern'+i)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", (_, i) => parameters['gridPattern'+i+'Density'])
        .attr("height", (_, i) => parameters['gridPattern'+i+'Density'])
        .attr('patternTransform', function (d,i){
            let x = parameters['gridPattern'+i+'X']
            let y = parameters['gridPattern'+i+'Y']
            let degree = parseFloat(parameters['gridPattern'+i+'Angle']) + parseFloat(parameters['gridPattern'+i+'Rotate'])

            return 'translate('+x+','+y+') rotate('+degree+')'
        })


    gridPattern.append('path')
        .attr('d','m -100 0 l 200 0')
        .attr("stroke-width", (_, i) => parameters['gridPattern'+i+'StrokeWidth'])
        .attr('stroke',function (d,i){
            if(parameters['gridPattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['gridPattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    return defs
}
function para_iconTextures(e, data, parameters, textureID){//textureID: when we need several sets of geo texture, we use this textureID to distinguish them

    let defs = e.append("defs")

    defs.selectAll("symbol_stroke") //stroke style <symbol> for iconic textures
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => textureID+'_stroke_'+fruits[i])
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon0`) // e.g. carrotIcon0, 0 refers to stroke.
        .attr('transform', (_, i) => 'rotate('+parameters['iconPattern'+i+'RotateIcon']+' 25 25) translate(0 0)')
        .append("path")
        .attr("d", (_, i) => strokePathsList[i])


    defs.selectAll("detail_stroke") //detail style <symbol> for iconic textures
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => textureID+'_detail_'+fruits[i])
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon1`) // e.g. carrotIcon1, 1 refers to detail.
        .attr('transform', (_, i) => 'rotate('+parameters['iconPattern'+i+'RotateIcon']+' 25 25) translate(0 0)')
        .append("path")
        .attr("d", (_, i) => detailPathsList[i])


    defs.selectAll("simple_stroke") //simple_stroke style <symbol> for iconic textures
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => textureID+'_simple_stroke_'+fruits[i])
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon2`) // e.g. carrotIcon2, 2 refers to simple_stroke.
        .attr('transform', (_, i) => 'rotate('+parameters['iconPattern'+i+'RotateIcon']+' 25 25) translate(0 0)')
        .append("path")
        .attr("d", (_, i) => simple_stroke_paths_list[i])


    defs.selectAll("simple_fill") //simple_fill style <symbol> for iconic textures
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => textureID+'_simple_fill_'+fruits[i])
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon3`) // e.g. carrotIcon3, 3 refers to simple_stroke.
        .attr('transform', (_, i) => 'rotate('+parameters['iconPattern'+i+'RotateIcon']+' 25 25) translate(0 0)')
        .append("path")
        .attr("d", (_, i) => simple_fill_paths_list[i])


    let pattern = defs.selectAll("pattern")
        .data(data)
        .enter()
        .append("pattern")
        .attr("id", (_, i) => textureID+'_iconPattern'+i)
        .attr("patternUnits", "userSpaceOnUse")
        // .attr("width", (_, i) => patternSize/parameters['iconPattern'+i+'Density'])
        // .attr("height", (_, i) => patternSize/parameters['iconPattern'+i+'Density'])
        .attr("width", (_, i) => parameters['iconPattern'+i+'Density'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Density'])
        .attr('patternTransform', function (d,i){
            let x = parameters['iconPattern'+i+'X']
            let y = parameters['iconPattern'+i+'Y']
            let degree = parameters['iconPattern'+i+'Rotate']

            return 'translate('+x+','+y+') rotate('+degree+')'
        })
    pattern.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 400)
        .attr("height", 400)
        .attr("stroke-width", 0)
        .attr('fill',function (d,i){
            if(parameters['iconPattern'+i+'Background'] == 0){
                return 'white'
            }
            if(parameters['iconPattern'+i+'Background'] == 1){
                return 'black'
            }
        })

    pattern.append("use") //1st <use>
        .attr("width", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr('href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('xlink:href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('fill',function (d,i){
            if(parameters['iconPattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['iconPattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    pattern.append("use") //2nd <use>
        .attr("width", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Size'])
        // .attr('x', (_, i) => -1*patternSize/parameters['iconPattern'+i+'Density'])
        .attr('x', (_, i) => -1*parameters['iconPattern'+i+'Density'])
        .attr('href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('xlink:href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('fill',function (d,i){
            if(parameters['iconPattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['iconPattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    pattern.append("use") //3rd <use>
        .attr("width", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Size'])
        // .attr('x', (_, i) => patternSize/parameters['iconPattern'+i+'Density'])
        .attr('x', (_, i) => parameters['iconPattern'+i+'Density'])
        .attr('href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('xlink:href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('fill',function (d,i){
            if(parameters['iconPattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['iconPattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    pattern.append("use") //4th <use>
        .attr("width", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Size'])
        // .attr('y', (_, i) => -1*patternSize/parameters['iconPattern'+i+'Density'])
        .attr('y', (_, i) => -1*parameters['iconPattern'+i+'Density'])
        .attr('href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('xlink:href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('fill',function (d,i){
            if(parameters['iconPattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['iconPattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    pattern.append("use") //5th <use>
        .attr("width", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Size'])
        // .attr('y', (_, i) => patternSize/parameters['iconPattern'+i+'Density'])
        .attr('y', (_, i) => parameters['iconPattern'+i+'Density'])
        .attr('href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('xlink:href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('fill',function (d,i){
            if(parameters['linePattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['linePattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    pattern.append("use") //6th <use>
        .attr("width", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Size'])
        // .attr('y', (_, i) => patternSize/parameters['iconPattern'+i+'Density'])
        .attr('x', (_, i) => -1 * parameters['iconPattern'+i+'Density'])
        .attr('y', (_, i) => -1 * parameters['iconPattern'+i+'Density'])
        .attr('href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('xlink:href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('fill',function (d,i){
            if(parameters['linePattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['linePattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    pattern.append("use") //7th <use>
        .attr("width", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Size'])
        // .attr('y', (_, i) => patternSize/parameters['iconPattern'+i+'Density'])
        .attr('x', (_, i) => parameters['iconPattern'+i+'Density'])
        .attr('y', (_, i) => -1 * parameters['iconPattern'+i+'Density'])
        .attr('href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('xlink:href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('fill',function (d,i){
            if(parameters['linePattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['linePattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    pattern.append("use") //8th <use>
        .attr("width", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Size'])
        // .attr('y', (_, i) => patternSize/parameters['iconPattern'+i+'Density'])
        .attr('x', (_, i) => -1 * parameters['iconPattern'+i+'Density'])
        .attr('y', (_, i) => parameters['iconPattern'+i+'Density'])
        .attr('href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('xlink:href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('fill',function (d,i){
            if(parameters['linePattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['linePattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    pattern.append("use") //0th <use>
        .attr("width", (_, i) => parameters['iconPattern'+i+'Size'])
        .attr("height", (_, i) => parameters['iconPattern'+i+'Size'])
        // .attr('y', (_, i) => patternSize/parameters['iconPattern'+i+'Density'])
        .attr('x', (_, i) => parameters['iconPattern'+i+'Density'])
        .attr('y', (_, i) => parameters['iconPattern'+i+'Density'])
        .attr('href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('xlink:href', (_, i) => '#para_'+ iconStyleList[parameters['iconPattern'+i+'IconStyle']]+'_'+fruits[i])
        .attr('fill',function (d,i){
            if(parameters['linePattern'+i+'Background'] == 0){
                return 'black'
            }
            if(parameters['linePattern'+i+'Background'] == 1){
                return 'white'
            }
        })

    return defs
}

function drawIconLegend(legendID, fruits){ //draw UI elements for legends of iconic charts
    let legend = document.getElementById(legendID) //id of div for legends

    for(let i = 0; i < fruits.length; i++){
        let div = document.createElement('div')
        legend.appendChild(div)

        let j = i+1
        let svg = d3.select('#'+legendID)
            .select(('div:nth-child('+j+')'))
            .append('svg')
            .attr('width', '150px')
            .attr('height', '30px')

        svg.append('circle')
            .attr('class','legendIndicator')
            .attr('cx', '10px')
            .attr('cy', '15px')
            .attr('r', '5px')
            .attr('fill', '#ffffff')


        svg.append('rect')
            .attr('class',function(){return 'iconPattern'+i+'Background category'+i})
            .attr('x', '20px')
            .attr('y', '0px')
            .attr('width', '30px')
            .attr('height', '30px')
            .attr('strokeWidth', '0px')
            .attr('fill', 'white')


        // svg.append('image')
        //     .attr('class',function(){
        //                         console.log('image'+i)
        //                         return 'legendImg category'+i
        //                     })
        //     .attr('x', '22px')
        //     .attr('y', '2px')
        //     .attr('width', '25px')
        //     .attr('height', '25px')

        svg.append('use')
            .attr('class',function(){
                return 'legendImg category'+i
            })
            // .attr('x', '22px')
            // .attr('y', '2px')
            .attr('width', '25px')
            .attr('height', '25px')
            .attr('transform', 'translate(22 2)')

        svg.append('text')
            .attr('class',function(){
                return 'legendLabel category'+i
            })
            .attr('x', '60px')
            .attr('y', '20px')
            .text(fruits[i])
    }
}

function drawGeoControllers(){ //draw controllers for geometric texture page

    $('#outlineDiv').append(drawSlider('Outline Stroke Width','controlOutline', '', '0', '5', '1', '0.1'))

    if(!chartName.startsWith('bar')){
        $('#outlineDiv').append(drawSlider('White Halo Stroke Width','controlHalo', '', '0', '7', '3', '0.1'))
    }
    let controllerDiv = document.getElementById('controllerDiv')

    let patternTypeDiv = document.createElement('div')
    controllerDiv.appendChild(patternTypeDiv)
    patternTypeDiv.id = 'patternTypeDiv'

    let lineControllersDiv = document.createElement('div')
    controllerDiv.appendChild(lineControllersDiv)
    lineControllersDiv.id = 'lineControllersDiv'
    lineControllersDiv.style.float = 'left'
    lineControllersDiv.style.display = 'none'

    let dotControllersDiv = document.createElement('div')
    controllerDiv.appendChild(dotControllersDiv)
    dotControllersDiv.id = 'dotControllersDiv'
    dotControllersDiv.style.float = 'left'
    dotControllersDiv.style.display = 'none'

    let gridControllersDiv = document.createElement('div')
    controllerDiv.appendChild(gridControllersDiv)
    gridControllersDiv.id = 'gridControllersDiv'
    gridControllersDiv.style.float = 'left'
    gridControllersDiv.style.display = 'none'


    $('#patternTypeDiv').append(drawRadios('Texture Type', ['Line', 'Dot', 'Grid'], ['lineRadio', 'dotRadio', 'gridRadio'], 'patternTypeRadio', 'patternTypeRadio'))
    $('#lineRadio').parents()[1].append(drawCheckbox('samePatternType','same','for all'))

    //line controllers
    $('#lineControllersDiv').append(drawSlider('Density','controlLineDensity', 'lineController densityController', '2', '40', '20', '0.1'))
    $('#controlLineDensity').parents()[0].append(drawCheckbox('sameLineDensity','same','for all lines'))

    $('#lineControllersDiv').append(drawSlider('Stroke Width','controlLineStrokeWidth', 'lineController', '0', '10', '5', '0.1'))
    $('#controlLineStrokeWidth').parents()[0].append(drawCheckbox('sameLineStrokeWidth','same','for all lines'))

    $('#lineControllersDiv').append(drawSlider('Rotation','controlLineRotate', 'lineController', '0', '180', '0', '0.1'))
    $('#controlLineRotate').parents()[0].append(drawCheckbox('sameLineRotate','same','for all lines'))

    //add special angle buttons to line rotation controller
    $('#controlLineRotate').parent()[0].id = 'controlLineRotateDiv'
    $('#controlLineRotateDiv').append(document.createElement('div'))
    $('#controlLineRotateDiv').append(drawButton('controlLineAngle0','lineController btn btn-outline-secondary','0°'))
    $('#controlLineRotateDiv').append(drawButton('controlLineAngle45','lineController btn btn-outline-secondary','45°'))
    $('#controlLineRotateDiv').append(drawButton('controlLineAngle90','lineController btn btn-outline-secondary','90°'))
    $('#controlLineRotateDiv').append(drawButton('controlLineAngle135','lineController btn btn-outline-secondary','135°'))

    $('#lineControllersDiv').append(drawRadios('Background Color', ['White', 'Black'], ['controlLineBackgroundWhite', 'controlLineBackgroundBlack'], 'controlLineBackgroundRadio lineController', 'controlLineBackgroundRadio'))
    $('#controlLineBackgroundWhite').parents()[1].append(drawCheckbox('sameLineBackground','same','for all lines'))


    //texture position
    $('#lineControllersDiv').append(document.createElement('br')) //blank line

    $('#lineControllersDiv').append(document.createElement('p').appendChild(document.createTextNode('Texture Position')))

    $('#lineControllersDiv').append(drawSlider('Move Left-Right','controlLineX', 'lineController', '-100', '100', '0', '0.1'))
    $('#controlLineX').parents()[0].append(drawCheckbox('sameLineX','same','for all lines'))

    $('#lineControllersDiv').append(drawSlider('Move Up-Down','controlLineY', 'lineController', '-100', '100', '0', '0.1'))
    $('#controlLineY').parents()[0].append(drawCheckbox('sameLineY','same','for all lines'))

    //dot controllers
    $('#dotControllersDiv').append(drawSlider('Density','controlDotDensity', 'dotController densityController', '2', '40', '20', '0.1'))
    $('#controlDotDensity').parents()[0].append(drawCheckbox('sameDotDensity','same','for all dots'))

    $('#dotControllersDiv').append(drawSlider('Dot Size','controlDotSize', 'dotController', '0', '10', '5', '0.1'))
    $('#controlDotSize').parents()[0].append(drawCheckbox('sameDotSize','same','for all dots'))

    $('#dotControllersDiv').append(drawSlider('Rotation','controlDotRotate', 'dotController', '0', '180', '0', '0.1'))
    $('#controlDotRotate').parents()[0].append(drawCheckbox('sameDotRotate','same','for all dots'))

    //add special angle buttons to dot rotation controller
    $('#controlDotRotate').parents()[0].id = 'controlDotRotateDiv'
    $('#controlDotRotateDiv').append(document.createElement('div'))
    $('#controlDotRotateDiv').append(drawButton('controlDotAngle0','dotController btn btn-outline-secondary','0°'))
    $('#controlDotRotateDiv').append(drawButton('controlDotAngle45','dotController btn btn-outline-secondary','45°'))

    $('#dotControllersDiv').append(drawRadios('Primitive Type', ['Dot', 'Circle'], ['controlDotPrimitiveDot', 'controlDotPrimitiveCircle'], 'controlDotPrimitiveRadio dotController', 'controlDotPrimitiveRadio'))
    $('#controlDotPrimitiveDot').parents()[1].append(drawCheckbox('sameDotPrimitive','same','for all dots'))

    $('#controlDotPrimitiveDot').parents()[1].id = 'controlDotPrimitiveDiv'
    $('#controlDotPrimitiveDiv').append(drawSlider('Circle Stroke Width', 'controlDotPrimitiveStrokeWidth', 'dotController', '0', '5', '1', '0.1'))
    $('#controlDotPrimitiveStrokeWidth').parents()[0].append(drawCheckbox('sameDotPrimitiveStrokeWidth','same','for all dots'))
    $('#controlDotPrimitiveStrokeWidth').parents()[0].id = 'controlDotPrimitiveStrokeWidthDiv'

    $('#dotControllersDiv').append(drawRadios('Background Color', ['White', 'Black'], ['controlDotBackgroundWhite', 'controlDotBackgroundBlack'], 'controlDotBackgroundRadio dotController', 'controlDotBackgroundRadio'))
    $('#controlDotBackgroundWhite').parents()[1].append(drawCheckbox('sameDotBackground','same','for all dots'))

    //texture position
    $('#dotControllersDiv').append(document.createElement('br')) //blank line

    $('#dotControllersDiv').append(document.createElement('p').appendChild(document.createTextNode('Texture Position')))

    $('#dotControllersDiv').append(drawSlider('Move Left-Right','controlDotX', 'dotController', '-100', '100', '0', '0.1'))
    $('#controlDotX').parents()[0].append(drawCheckbox('sameDotX','same','for all dots'))

    $('#dotControllersDiv').append(drawSlider('Move Up-Down','controlDotY', 'dotController', '-100', '100', '0', '0.1'))
    $('#controlDotY').parents()[0].append(drawCheckbox('sameDotY','same','for all dots'))

    //grid controllers
    $('#gridControllersDiv').append(drawSlider('Density','controlGridDensity', 'gridController densityController', '4', '40', '20', '0.1'))
    $('#controlGridDensity').parents()[0].append(drawCheckbox('sameGridDensity','same','for all grids'))

    $('#gridControllersDiv').append(drawSlider('Stroke Width','controlGridStrokeWidth', 'gridController', '0', '10', '5', '0.1'))
    $('#controlGridStrokeWidth').parents()[0].append(drawCheckbox('sameGridStrokeWidth','same','for all grids'))

    $('#gridControllersDiv').append(drawSlider('Angle Between Two Lines', 'controlGridAngle', 'gridController', '0', '90', '0', '0.1'))
    $('#controlGridAngle').parents()[0].append(drawCheckbox('sameGridAngle','same','for all grids'))

    $('#controlGridAngle').parent()[0].id = 'controlGridAngleDiv'
    $('#controlGridAngleDiv').append(document.createElement('div'))
    $('#controlGridAngleDiv').append(drawButton('controlGridAngle15','gridController btn btn-outline-secondary','30°'))
    $('#controlGridAngleDiv').append(drawButton('controlGridAngle30','gridController btn btn-outline-secondary','60°'))
    $('#controlGridAngleDiv').append(drawButton('controlGridAngle45','gridController btn btn-outline-secondary','90°'))

    //add special angle buttons to grid rotation controller
    $('#gridControllersDiv').append(drawSlider('Rotation','controlGridRotate', 'gridController', '0', '180', '0', '0.1'))
    $('#controlGridRotate').parents()[0].append(drawCheckbox('sameGridRotate','same','for all grids'))

    $('#controlGridRotate').parent()[0].id = 'controlGridRotateDiv'
    $('#controlGridRotateDiv').append(document.createElement('div'))
    $('#controlGridRotateDiv').append(drawButton('controlGridRotate30','gridController btn btn-outline-secondary','30°'))
    $('#controlGridRotateDiv').append(drawButton('controlGridRotate45','gridController btn btn-outline-secondary','45°'))
    $('#controlGridRotateDiv').append(drawButton('controlGridRotate60','gridController btn btn-outline-secondary','60°'))

    $('#gridControllersDiv').append(drawRadios('Background Color', ['White', 'Black'], ['controlGridBackgroundWhite', 'controlGridBackgroundBlack'], 'controlGridBackgroundRadio gridController', 'controlGridBackgroundRadio'))
    $('#controlGridBackgroundWhite').parents()[1].append(drawCheckbox('sameGridBackground','same','for all grids'))

    //texture position
    $('#gridControllersDiv').append(document.createElement('br')) //blank line

    $('#gridControllersDiv').append(document.createElement('p').appendChild(document.createTextNode('Texture Position')))

    $('#gridControllersDiv').append(drawSlider('Move Left-Right','controlGridX', 'gridController', '-100', '100', '0', '0.1'))
    $('#controlGridX').parents()[0].append(drawCheckbox('sameGridX','same','for all grids'))

    $('#gridControllersDiv').append(drawSlider('Move Up-Down','controlGridY', 'gridController', '-100', '100', '0', '0.1'))
    $('#controlGridY').parents()[0].append(drawCheckbox('sameGridY','same','for all grids'))

    setSameCheckboxesStatus(chartName)
}

function drawIconicControllers(){
    $('#outlineDiv').append(drawSlider('Outline Stroke Width','controlOutline', '', '0', '5', '1', '0.1'))

    if(!chartName.startsWith('bar')){
        $('#outlineDiv').append(drawSlider('White Halo Stroke Width','controlHalo', '', '0', '7', '3', '0.1'))
    }

    $('#controllerDiv').append(drawRadios('Icon Style', ['', '', '', ''], ['strokeRadio', 'detailRadio','simpleStrokeRadio','simpleFillRadio'], 'iconStyleRadio', 'iconStyle'))
    // $('#strokeRadio+label').append(drawImg('strokeImg', '30', '30')) //add img to radio label
    // $('#detailRadio+label').append(drawImg('detailImg', '30', '30')) //add img to radio label
    d3.select('#strokeRadio+label')
        .append('svg')
        .attr('width', '30')
        .attr('height','30')
        .append('use')
        .attr('id', 'strokeImg')
        .attr('width', '30')
        .attr('height','30')

    d3.select('#detailRadio+label')
        .append('svg')
        .attr('width', '30')
        .attr('height','30')
        .append('use')
        .attr('id', 'detailImg')
        .attr('width', '30')
        .attr('height','30')

    d3.select('#simpleStrokeRadio+label')
        .append('svg')
        .attr('width', '30')
        .attr('height','30')
        .append('use')
        .attr('id', 'simpleStrokeImg')
        .attr('width', '30')
        .attr('height','30')

    d3.select('#simpleFillRadio+label')
        .append('svg')
        .attr('width', '30')
        .attr('height','30')
        .append('use')
        .attr('id', 'simpleFillImg')
        .attr('width', '30')
        .attr('height','30')

    $('#strokeRadio').parents()[1].append(drawCheckbox('sameIconStyle','same','for all'))

    // if(chartName == "barIcon"){
    //     $('#controllerDiv').append(drawSliderWithTicks('Density','controlDensityOutput','controlDensity', '', '0.00001', '5.00001', '1', '0.1',[0,1,2,3,4,5], 'Restrict to', ['major ticks', 'all ticks', 'no restriction'], ['densityMajorticksRadio', 'densityMinorticksRadio', 'densityNorestrictionRadio'], '','densityCheckbox')) //Because the value of the density has to be the numerator, the minimum value cannot be set to 0. We set it to 0.01
    //     $(drawCheckbox('sameDensity','same','For all bars')).insertAfter($('#controlDensity').parents()[1])
    //     document.getElementById('densityNorestrictionRadio').checked = true
    // }else{
        $('#controllerDiv').append(drawSlider('Density','controlDensity', '', '10', '60', '45', '0.1')) //Because the value of the density has to be the numerator, the minimum value cannot be set to 0. We set it to 0.001
        $('#controlDensity').parents()[0].append(drawCheckbox('sameDensity','same','for all'))
    // }



    $('#controllerDiv').append(drawSlider('Size','controlSize', '', '0', '100', '40', '0.1'))
    $('#controlSize').parents()[0].append(drawCheckbox('sameSize','same','for all'))

    $('#controllerDiv').append(drawSlider('Move Left-Right','controlX', '', '-100', '100', '0', '0.1'))
    $('#controlX').parents()[0].append(drawCheckbox('sameX','same','for all'))

    $('#controllerDiv').append(drawSlider('Move Up-Down','controlY', '', '-100', '100', '0', '0.1'))
    $('#controlY').parents()[0].append(drawCheckbox('sameY','same','for all'))


    $('#controllerDiv').append(drawSliderWithTicks('Icon Rotation','','controlRotateIcon', '', '0', '360', '0', '0.1',['0°','90°','180°','270°','360°'], 'Restrict to', ['major ticks', 'all ticks', 'no restriction'], ['rotateIconMajorticksRadio', 'rotateIconMinorticksRadio', 'rotateIconNorestrictionRadio'], '','rotateIconCheckbox'))
    $(drawCheckbox('sameRotateIcon','same','for all')).insertAfter($('#controlRotateIcon').parents()[1])
    document.getElementById('rotateIconNorestrictionRadio').checked = true


    $('#controllerDiv').append(drawSlider('Rotation','controlRotate', '', '0', '360', '0', '0.1'))
    $('#controlRotate').parents()[0].id = 'controlRotateDiv'
    $('#controlRotateDiv').append(drawCheckbox('sameRotate','same','for all'))
    $('#controlRotateDiv').append(document.createElement('div'))
    // $('#controlRotateDiv').append(drawButton('controlAngle0','','Diamond'))
    $('#controlRotateDiv').append(drawButton('controlAngle90','btn btn-outline-secondary','90°'))

    $('#controllerDiv').append(drawRadios('Background Color', ['White', 'Black'], ['controlBackgroundWhite', 'controlBackgroundBlack'], 'controlBackgroundRadio', 'controlBackgroundRadio'))
    $('#controlBackgroundWhite').parents()[1].append(drawCheckbox('sameBackground','same','for all'))

    //set radios to control step of density controller
    icon_setDensityTicks()
    //set radios to control step of rotate icon controller
    icon_setRotateIconTicks()

    setSameCheckboxesStatus(chartName)
}

function drawGeoLegend(data){
    // let legendDiv = document.getElementById('legend')
    // legendDiv.style.display = 'flex'

    let legends = d3.select('#legend')
        .append('svg')
        .attr('height', 300)
        .attr('width', 150)
        .append('g') //group of the seven legends
        .attr('transform', 'translate(20, 0)') //leave place to show legendIndicators



    legends.selectAll('.colorbar') //add line for grid textures in the legends
        // .data(d3.range(fruits.length))
        .data(data)
        .enter()
        .append('svg:rect')
        .attr('y', (d,i) => i*(30+10) + 'px') //30: side length of rectangles, 10: interval between legend rectangles
        .attr('height', '30px')
        .attr('width', '30px')
        .attr('x', '0px')
        .attr('fill', function(d, i){
            return  'url(#gridPatternA' + i + ')'
        })

    legends.selectAll('.colorbar') //add textures in the legends
        // .data(d3.range(fruits.length))
        .data(data)
        .enter()
        .append('svg:rect')
        .attr('class', function(d, i) { //both d and i are 0,1,2,3,4,5,6 (d=i)
            return 'category' + i   //category+i : this class is used for setting pattern
        })
        .attr('y', (d,i) => i*(30+10) + 'px') //30: side length of rectangles, 10: interval between legend rectangles
        .attr('height', '30px')
        .attr('width', '30px')
        .attr('x', '0px')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('fill', function(d, i){

            //get x,y for legendIndicator. We don't have to put them in 'fill'
            //we cannot include 'px' here, see: https://stackoverflow.com/questions/46590005/expected-svg-transforms-throwing-error
            legendIndicatorX.push(-10)
            legendIndicatorY.push(i*(30+10) + 15)

            return  'url(#linePattern' + i + ')' })

    //legend indicators
    legends.selectAll('.legendIndicator')
        // .data(d3.range(fruits.length))
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 5)
        .attr('class', 'legendIndicator')
        .attr('transform', function(d, i) {
            return 'translate(' + legendIndicatorX[i] + ',' + legendIndicatorY[i] + ')'; })// move the indicators to the position we got before


    //legend text labels
    legends.selectAll('text')
        .data(data)
        .enter()
        .append('text')
        .attr('class', function(d,i){
            return 'legendLabel category'+i
        })
        .attr('x', 40)
        .attr('y', (d, i) => i*40 + 20)
        .attr('fill', 'black')
        .text(d => d)
}


/**
 * draw a bar chart
 * @param svgID - we append the chart we draw to this svg
 * @param width - the width of the bar itself (not include labels, ticks)
 * @param height - the height of the bar itself (not include labels, ticks)
 * @param data
 * @returns {*[]}
 */
function drawBar(svgID, width, height, data){
    let svg = d3.select(svgID),
        margin = svg.attr('width') - width


        // width = svg.attr('width')-margin,
        // height = svg.attr('height')-margin

    // x and y axis
    let xScale = d3.scaleBand().range([0, width]).padding(0.2),
        yScale = d3.scaleLinear().range([height, 0])

    let g = svg.append('g')
        .attr('transform', 'translate(' + margin/2 + ',' + margin/2 + ')')

    //add data to x y axis
    xScale.domain(data.map(function(d) { return d.fruit; }))
    // yScale.domain([0, d3.max(data, function(d) { return d.value; })])
    yScale.domain([0, 100]) //fix the max of y to 100

    // x axis ticks and labels
    let xAxis = g.append('g')
        .attr('transform', 'translate(0,' + height + ')')
        .style("font-size", "12px") //font size of tick labels
        .call(d3.axisBottom(xScale))

    // xAxis.selectAll('.tick').remove() // remove ticks on x axis
    // xAxis.selectAll('text').remove() // remove tick labels on x axis

    // y axis ticks
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(function(d){
            return d
        }).ticks(10))

    //create bars based on data
    let bars = g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', function(d) { return xScale(d.fruit) })
        .attr('y', function(d) { return yScale(d.value) })
        .attr('width', xScale.bandwidth())
        .attr('height', function(d) { return height - yScale(d.value) })

    return [bars, xScale]
}

function drawPie(svgID,radius,data, withLabel){
    //create svg for chart
    let svg = d3.select(svgID),
        width = svg.attr('width'),
        height = svg.attr('height')

    let g = svg.append('g')
        .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')//put the pie chart at the center of svg#piechart

    // Generate the pie
    let pie = d3.pie()
        .sort(null)
        .value(function(d) {
        return d.value; // column name of value
        })(data)


    // Generate the arcs
    let path = d3.arc()
        .outerRadius(radius)
        .innerRadius(0)

    //Generate groups
    let arc = g.selectAll('.arc')
        .data(pie)
        .enter().append('g')
        .append('path')
        .attr('d', path)
        .attr('stroke-linejoin', 'round') //avoid sharp corner of strokes

    let labelArc = d3.arc() // arc for labels
        .outerRadius(parseFloat(radius) + 90) //distance of labels from chart
        .innerRadius(radius)

    if(withLabel){
        // d3.select(svgID)
        //     .select('g')
        g.selectAll('.label')
        .data(pie)
        .enter()
        .append('text')
        .text((d) => d.data.fruit) //d is pie, rather than the fruits list
        .style('font-size','14px')
        .attr('x', 0)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('class', 'label')
        .attr('fill', 'black')
        .attr('transform', function (d, i) {
            return 'translate(' + labelArc.centroid(d)[0] + ',' + labelArc.centroid(d)[1] + ') ';
        })
    }


    return arc
}

function drawMap(svgID, geojson, path, departmentsID, width, height){
    let svg = d3.select(svgID)
        .attr('width', width)
        .attr('height', height)

    let deps = svg.append('g')
        .attr('transform', 'translate(' + 50 + ',' + 0 + ')')//put the pie chart at the center of svg#piechart

    deps
        .selectAll('path')
        .data(geojson.features)
        .enter()
        .append('path')
        .attr('id', d => departmentsID + d.properties.CODE_DEPT) //1 - 9 should be 01 - 09 in .csv
        .attr('d', path)
        .attr('stroke-linejoin', 'round') //avoid sharp corner of strokes

    return deps
}

/**
 * @param chart: the id for the div to append chart
 * @param data: the data for the chart
 */
function drawGeoBarWithTexture(data, width, height, chart){

    //create barcharts
    let barsA = drawBar('#'+chart+'A', width, height, data)[0]

    barsA
        .attr('fill', function(d,i) {
            return  'url(#gridPatternA' + i +')'
        })

    let barsResults = drawBar('#'+chart, width, height, data) //get the results from drawBar(), because this function will return two values
    let bars = barsResults[0]
    let xScale = barsResults[1]

    bars
        .attr('class', function(d, i) {
            return 'chart_outline category' + i   //bar - used for get all <rect> of bars; category+i - used for setting pattern
        })
        .attr('stroke', 'black')
        .attr('stroke-width', controlOutline.value)
        .attr('fill', function(d,i) {

            // indicatorX.push(xScale(d.fruit) + xScale.bandwidth()/2)
            // indicatorY.push(330)

            return  'url(#linePattern' + i +')'
        })

    //set Outline controller
    controlOutline.oninput = function(){
        drawOutline('chart_outline', controlOutline.value)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlOutline.onchange = function(){
        parameters['outline'] = controlOutline.value

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

}

/**
 * Get the dataset used to draw the chart. Determine whether to use the default dataset or generate a random fruit dataset.
 * @returns {[{fruit: string, value: number},{fruit: string, value: number},{fruit: string, value: number},{fruit: string, value: number},{fruit: string, value: number},null,null]}
 */
function getDatasetForChart(){
    let data
    //if we do not use the default data set
    if(localStorage.getItem('defaultData') == 0){
        //we generate a random dataset
        data = generateRandomFruitsDataset(fruits)
    }
    //if we have not set the status of using default data set, which means we draw charts for the first time
    if(localStorage.getItem('defaultData') == null){
        //we use the default data set
        localStorage.setItem('defaultData', 1)
    }
    //if we use the default data set
    if(localStorage.getItem('defaultData') == 1){
        data = defaultDataset
    }
    return data
}
function getDatasetForMap(){
    let data
    //if we do not use the default data set
    if(localStorage.getItem('defaultData') == 0){
        //we generate a random dataset
        data = generateRandomMapDataset()
    }
    //if we have not set the status of using default data set, which means we draw charts for the first time
    if(localStorage.getItem('defaultData') == null){
        //we use the default data set
        localStorage.setItem('defaultData', 1)
    }
    //if we use the default data set
    if(localStorage.getItem('defaultData') == 1){
        data = defaultMapDataset
    }
    return data
}


/**
 * draw indicators and labels for pie chart
 * @param data
 * @param radius radius of the pie chart
 * @param chart part of the chart id of the pie chart
 * @param offset offset of the circle of indicator
 */
function drawPieIndicators(data, radius, chart, offset) {
    let indicatorArc = d3.arc() // arc for indicator
        .outerRadius(radius + offset)
        .innerRadius(radius)
    let pie = d3.pie()
        .sort(null)
        .value(function (d) {
        return d.value; // column name of value
    })(data)

    //Generate indicators
    d3.select('#'+chart)
        .select('g')
        .append('g')
        .attr('id', 'indicator_group')
        .selectAll('.indicator')
        .data(pie)
        .enter()
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 8)
        .attr('fill', 'none')
        .attr('class', 'indicator')
        .attr('transform', function (d, i) {
            // var midAngle = d.endAngle < Math.PI ? d.startAngle/2 + d.endAngle/2 : d.startAngle/2  + d.endAngle/2 + Math.PI ;
            return 'translate(' + indicatorArc.centroid(d)[0] + ',' + indicatorArc.centroid(d)[1] + ') ' // move the indicators to the position
        })
}

/**
 * draw indicators for bar chart
 * @param data - an array with a length the same as the number of the categories for the bar chart. Here we can use the fruits array.
 * @param width - width of the bar chart
 * @param height - height of the bar chart
 * @param chart - the id indicator of the svg that we will append the bar chart to
 * @param offset - the distance the circular pointer is offset from the x-axis
 */
function drawBarIndicators(data, width, height, chart, offset){

    let indicatorX = []
    let xScale = d3.scaleBand().range([0, width]).padding(0.2)
    //add data to x y axis
    xScale.domain(data.map(function(d) { return d.fruit; }))

    for(let i = 0; i < data.length; i++){
        indicatorX.push(xScale(data[i].fruit) + xScale.bandwidth()/2)
    }
    let indicatorY = height + offset

    d3.select('#'+chart)
        .select('g')
        .append('g')
        .attr('id', 'indicator_group')
        .selectAll('.indicator')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 8)
        .attr('class', 'indicator')
        .attr('fill', 'none')
        .attr('transform', function(d, i) {
            return 'translate(' + indicatorX[i] + ',' + indicatorY + ') '
        }) // move the indicators to the position we got before
}

function drawGeoPieWithTexture(data, radius, chart){

    //pie chart for one line of grid pattern
    let arcA = drawPie('#'+chart+'A',radius,data, false)
    arcA
        .attr('stroke', 'none')
        .attr("fill", function(d,i) {
            return  'url(#gridPatternA' + i +')'})

    //main pie chart
    let arc = drawPie('#'+chart,radius, data, true)
    arc.attr("class", function(d, i) {
        return 'chart_shape category' + i   //chart_shape: shape of each part of chart; category+i : this class is used for setting pattern
    })
        .attr('stroke', "black")
        .attr('stroke-width', 0)
        .attr('fill', function(d,i) {
            return  'url(#linePattern' + i + ')'
        })

    //pie chart for the white halo
    let arcWhiteStroke = drawPie("#chartWhiteStroke",radius,data, false)
    arcWhiteStroke
        .attr('stroke', "white")
        .attr('stroke-width', parseFloat(controlHalo.value) + parseFloat(controlOutline.value))
        .attr("fill", 'none')
        .attr('class', 'chart_halo') //this is chart's white halo

    //pie chart for the black outline
    let arcBlackStroke = drawPie("#chartBlackStroke",radius,data, false)
    arcBlackStroke
        .attr('stroke', "black")
        .attr('stroke-width', controlOutline.value)
        .attr("fill", 'none')
        .attr('class','chart_outline') //this is chart's black outline

    //change outline based on the value of outline controller
    controlOutline.oninput = function(){
        drawOutline('chart_outline', controlOutline.value, 'chart_halo', controlHalo.value)
        // arcBlackStroke.style('stroke-width', controlOutline.value)
        // arcWhiteStroke.style('stroke-width', parseFloat(controlHalo.value) + parseFloat(controlOutline.value))
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlHalo.oninput = function(){
        drawOutline('chart_outline', controlOutline.value, 'chart_halo', controlHalo.value)
        // arcBlackStroke.style('stroke-width', controlOutline.value)
        // arcWhiteStroke.style('stroke-width', parseFloat(controlHalo.value) + parseFloat(controlOutline.value))
        revisitPostParameters(chartName, parameters, trrack, action)
    }


    controlOutline.onchange = function(){

        parameters["outline"] = controlOutline.value

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlHalo.onchange = function(){

        parameters["halo"] = controlHalo.value

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }
}

function drawGeoMapWithTexture(data, width, height, chart){

    let path = d3.geoPath()

    let projection = d3.geoConicConformal() // Lambert-93
        .center([2.454071, 46.279229]) // Center on France
        .scale(2600)
        .translate([width / 2 - 50, height / 2])

    path.projection(projection)

    let promises = [];
    promises.push(d3.json(filePath+'data/departments.json'))

    Promise.all(promises).then(function(values) {
        let geojson = values[0] // Recovery of the first promise: the content of the JSON file

        drawMap('#'+chart+'A', geojson, path, 'dA', width, height)
        drawMap('#'+chart,geojson,  path, 'd', width, height)
        drawMap('#'+chart+'WhiteStroke', geojson, path, 'dWhiteStroke', width, height)
        drawMap('#'+chart+'BlackStroke', geojson, path, 'dBlackStroke', width, height)

        let quantile = d3.scaleQuantile()
            .domain([0, d3.max(data, e => +e.POP)])
            .range(d3.range(fruits.length));

        data.forEach(function(e,i) {
            d3.select("#dA" + e.CODE_DEPT)
                .attr("fill", function(d){return  "url(#gridPatternA" + quantile(+e.POP) + ")" })

            d3.select("#d" + e.CODE_DEPT)
                .attr('stroke', 'none')
                .attr("class", function(d, index) {
                    return "category" + quantile(+e.POP) //this class is used for setting pattern
                })
                .attr("fill", function(d){return  "url(#linePattern" + quantile(+e.POP) + ")" })
            // .on("mouseover", function(event, d) {
            //     document.getElementById("regionName").innerHTML = e.NOM_REGION
            // })

            d3.select("#dWhiteStroke" + e.CODE_DEPT)
                .attr('fill','none')
                .attr('stroke', 'white')
                .attr('stroke-width', parseFloat(controlHalo.value) + parseFloat(controlOutline.value))
                .attr('class','chart_halo')


            d3.select("#dBlackStroke" + e.CODE_DEPT)
                .attr("class", function(d, index) {
                    return "chart_outline blackStroke strokeCategory" + quantile(+e.POP) //this class is used for setting pattern
                })
                .attr('fill','none')
                .attr('stroke', 'black')
                .attr('stroke-width', controlOutline.value)
        })

        //initialize: for map, we have to put this initialize function here in the Promise.
        geo_setInitialParameters()

        // change Map's outline based on the value of outline controller
        controlOutline.oninput = function(){
            drawOutline('chart_outline', controlOutline.value, 'chart_halo', controlHalo.value)
            // drawMapOutline(data, controlOutline.value, controlHalo.value)
            revisitPostParameters(chartName, parameters, trrack, action)
        }

        controlHalo.oninput = function(){
            drawOutline('chart_outline', controlOutline.value, 'chart_halo', controlHalo.value)
            // drawMapHalo(data, controlOutline.value, controlHalo.value)
            revisitPostParameters(chartName, parameters, trrack, action)
        }


        controlOutline.onchange = function(){

            parameters["outline"] = controlOutline.value

            addParametersToList(chartName, parameters)
            revisitPostParameters(chartName, parameters, trrack, action)
        }

        controlHalo.onchange = function(){

            parameters["halo"] = controlHalo.value

            addParametersToList(chartName, parameters)
            revisitPostParameters(chartName, parameters, trrack, action)
        }

        for(let i=0; i < fruits.length;i++){
            d3.selectAll(".category"+i)
                .on("click", function(event, d){// let controllers control the selected bar
                    console.log("selected pattern"+i)
                    geo_selectCat(i)
                    localStorage.setItem(chartName + "_selectedCat", i)

                    //add color indicator on the outline of the selected regions.
                    d3.selectAll('.blackStroke')
                        .attr('stroke', 'black')

                    d3.selectAll(".strokeCategory"+i)
                        .attr('filter', function(){this.parentNode.appendChild(this)}) //move the selected paths to the front of other paths
                        .attr('stroke', '#1E90FF')

                    let  thisNode = d3.select('#dBlackStroke'+event.target.id.replace(/\D/g, '')) //thisNode: the black stroke node that is clicked
                    thisNode
                        .attr('stroke','#1E90FF') //we can set the stroke of the region we click to a special color
                    // thisNode.node().parentNode.appendChild(thisNode.node())

                })
        }

        geo_switchTextures(chartName)

    });
}

function drawIconBarWithTexture(data, width, height, chart){

    let barsResults = drawBar('#'+chart, width, height, data) //get the results from drawBar(), because this function will return two values
    let bars = barsResults[0]
    let xScale = barsResults[1]

    // Generate the patterns
    // let legend = d3.select('svg#chart'),
    //     defs = iconTextures(legend, data)

    bars
        .attr('class', function(d, i) {
            return 'chart_outline category' + i   //category+i : this class is used for setting pattern
        })
        .attr('stroke', 'black')
        .attr('stroke-width', controlOutline.value)
        .attr('fill', function(d,i) {

            // indicatorX.push(xScale(d.fruit) + xScale.bandwidth()/2)
            // indicatorY.push(330)

            return  'url(#iconPattern' + i +')'
        })

    //change outline based on the value of outline controller
    controlOutline.oninput = function(){
        drawOutline('chart_outline', controlOutline.value)
        // bars.style('stroke-width', controlOutline.value)
        revisitPostParameters(chartName, parameters, trrack, action)
    }
    controlOutline.onchange = function(){
        parameters['outline'] = controlOutline.value

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }



}

function drawIconMapWithTexture(data, width, height, chart){

    let path = d3.geoPath()

    let projection = d3.geoConicConformal() // Lambert-93
        .center([2.454071, 46.279229]) // Center on France
        .scale(2600)
        .translate([width / 2 - 50, height / 2])

    path.projection(projection);

    let promises = []
    promises.push(d3.json(filePath+'data/departments.json'))

    Promise.all(promises).then(function(values) {
        let geojson = values[0]; // Recovery of the first promise: the content of the JSON file

        let deps = drawMap('#'+chart,geojson,  path, 'd', width,height)
        drawMap('#'+chart+'WhiteStroke', geojson, path, 'dWhiteStroke', width,height)
        drawMap('#'+chart+'BlackStroke', geojson, path, 'dBlackStroke', width,height)

        let quantile = d3.scaleQuantile()
            .domain([0, d3.max(data, e => +e.POP)])
            .range(d3.range(fruits.length)); // number of categories

        // // let defs = deps.append("defs")
        // iconTextures(d3.select('#'+chart+'A'), fruits)

        data.forEach(function(e,i) {

            d3.select("#d" + e.CODE_DEPT)
                .attr('stroke', 'none')
                .attr("class", function(d, i) {
                    return "departement category" + quantile(+e.POP) //this class is used for setting pattern
                })
                .attr("fill", function(d, i){return  "url(#iconPattern" + quantile(+e.POP) + ")" })

            d3.select("#dWhiteStroke" + e.CODE_DEPT)
                .attr('fill','none')
                .attr('stroke', 'white')
                .attr('stroke-width', parseFloat(controlHalo.value)+ parseFloat(controlOutline.value))
                .attr('class','chart_halo')

            d3.select("#dBlackStroke" + e.CODE_DEPT)
                .attr("class", function(d, index) {
                    return "chart_outline blackStroke strokeCategory" + quantile(+e.POP) //this class is used for setting pattern
                })
                .attr('fill','none')
                .attr('stroke', 'black')
                .attr('stroke-width', controlOutline.value)

        })

        //Initialize
        icon_setInitialParameters(chartName)

        //Initialize outline stroke width
        // csv.forEach(function(e,i) {
        // d3.select("#d" + e.CODE_DEPT)
        //     .attr('stroke-width', controlOutline.value)})

        // change Map's outline based on the value of outline controller
        // controlOutline.oninput = function(){
        //     data.forEach(function(e,i) {
        //         d3.select("#dWhiteStroke" + e.CODE_DEPT)
        //             .attr('stroke-width', 2+ parseFloat(controlOutline.value))
        //
        //         d3.select("#dBlackStroke" + e.CODE_DEPT)
        //             .attr('stroke-width', controlOutline.value)
        //
        //     })
        // }
        //
        // controlOutline.onchange = function(){
        //     parameters["outline"] = controlOutline.value
        //     parametersList.push(cloneParameters(parameters))
        //     localStorage.setItem(chartName+'parametersList', JSON.stringify(parametersList))
        // }

        // change Map's outline based on the value of outline controller
        controlOutline.oninput = function(){
            drawOutline('chart_outline', controlOutline.value, 'chart_halo', controlHalo.value)
            // data.forEach(function(e,i) {
            //     d3.select("#dWhiteStroke" + e.CODE_DEPT)
            //         .attr('stroke-width', parseFloat(controlHalo.value) + parseFloat(controlOutline.value))
            //
            //     d3.select("#dBlackStroke" + e.CODE_DEPT)
            //         .attr('stroke-width', controlOutline.value)
            // })
            revisitPostParameters(chartName, parameters, trrack, action)
        }

        controlHalo.oninput = function(){
            drawOutline('chart_outline', controlOutline.value, 'chart_halo', controlHalo.value)
            // data.forEach(function(e,i) {
            //     d3.select("#dWhiteStroke" + e.CODE_DEPT)
            //         .attr('stroke-width', parseFloat(controlHalo.value)+ parseFloat(controlOutline.value))
            //
            //     d3.select("#dBlackStroke" + e.CODE_DEPT)
            //         .attr('stroke-width', controlOutline.value)
            // })
            revisitPostParameters(chartName, parameters, trrack, action)
        }

        controlOutline.onchange = function(){

            parameters["outline"] = controlOutline.value

            addParametersToList(chartName, parameters)
            revisitPostParameters(chartName, parameters, trrack, action)
        }

        controlHalo.onchange = function(){

            parameters["halo"] = controlHalo.value

            addParametersToList(chartName, parameters)
            revisitPostParameters(chartName, parameters, trrack, action)
        }


        /* Select a category */
        for(let i=0; i < fruits.length;i++){
            d3.selectAll(".category"+i)
                .on("click", function(event, d){// let controllers control the selected bar
                    let departementIndex = parseInt(event.target.id.replace(/\D/g, '')) //get the departement number

                    icon_selectCat(i, departementIndex)
                    localStorage.setItem(chartName + "_selectedCat", i)

                    d3.selectAll('.blackStroke')
                        .attr('stroke', 'black')

                    d3.selectAll(".strokeCategory"+i)
                        .attr('filter', function(){this.parentNode.appendChild(this)}) //move the selected paths to the front of other paths
                        .attr('stroke', '#1E90FF')

                    let  thisNode = d3.select('#dBlackStroke'+event.target.id.replace(/\D/g, '')) //thisNode: the black stroke node that is clicked
                    thisNode
                        .attr('stroke','#1E90FF') //we can set the region we click to a special color

                    // thisNode.node().parentNode.appendChild(thisNode.node())

                    // console.log('click on departement' + event.target.id.replace(/\D/g, ''))
                    localStorage.setItem(chartName+"_selectPattern", event.target.id.replace(/\D/g, ''))
                })
        }

        icon_switchTextures(chartName)

    })
}

function drawIconPieWithTexture(data, radius, chart){


    let arc = drawPie('#'+chart, radius,data, true)
    arc
        .attr('class', function(d, i) {
            return 'category' + i   //category+i : this class is used for setting pattern
        })
        .attr('stroke', 'black')
        .attr('stroke-width', 0)
        .attr('fill', function(d,i) {
            return  'url(#iconPattern' + i +')'
        })

    //white halo
    let arcWhiteStroke = drawPie('#'+chart+'WhiteStroke',radius,data,false)
    arcWhiteStroke
        .attr('stroke', 'white')
        .attr('stroke-width', parseFloat(controlHalo.value)+ parseFloat(controlOutline.value))
        .attr('fill', 'none')
        .attr('class', 'chart_halo')

    let arcBlackStroke = drawPie('#'+chart+'BlackStroke',radius,data, false)
    arcBlackStroke
        .attr('stroke', 'black')
        .attr('stroke-width', controlOutline.value)
        .attr('fill', 'none')
        .attr('class','chart_outline')


    //change outline based on the value of outline controller
    controlOutline.oninput = function(){
        drawOutline('chart_outline', controlOutline.value, 'chart_halo', controlHalo.value)
        // arcBlackStroke.style('stroke-width', controlOutline.value)
        // arcWhiteStroke.style('stroke-width', parseFloat(controlHalo.value)+ parseFloat(controlOutline.value)+ parseFloat(controlOutline.value))
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlHalo.oninput = function(){
        drawOutline('chart_outline', controlOutline.value, 'chart_halo', controlHalo.value)
        // arcBlackStroke.style('stroke-width', controlOutline.value)
        // arcWhiteStroke.style('stroke-width', parseFloat(controlHalo.value) + parseFloat(controlOutline.value))
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlOutline.onchange = function(){

        parameters['outline'] = controlOutline.value

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlHalo.onchange = function(){

        parameters["halo"] = controlHalo.value

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

}


function drawColorBarFromParameters(data, chart, width, height,color){
    let bars = drawBar('#'+chart, width, height, data)[0] //get the results from drawBar(), because this function will return two values
    bars
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('fill', color)
}

function drawColorPieFromParameters(data, chart, radius, color){
    let arc = drawPie('#'+chart, radius,data, true)
    arc
        .attr('fill', color)

    //white halo
    let arcWhiteStroke = drawPie('#'+chart+'WhiteStroke',radius,data, false)
    arcWhiteStroke
        .attr('stroke', 'white')
        .attr('stroke-width', 3)
        .attr('fill', 'none')

    let arcBlackStroke = drawPie('#'+chart+'BlackStroke',radius,data, false)
    arcBlackStroke
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('fill', 'none')
}
/**
 * Draw charts from parameters
 * @param csvURL
 * @param chart
 * @param parameters
 * @param textureID - indicate using which texture set
 */
function drawGeoBarWithTextureFromParameters(data, chart, width, height, parameters, textureID){

    //create barcharts
    let barsA = drawBar('#'+chart+'A', width, height, data)[0]
    barsA
        .attr('fill', function(d,i) {
            return  'url(#'+textureID+'_gridPatternA' + i +')'
        })

    let bars = drawBar('#'+chart, width, height, data)[0]

    bars
        .attr('fill', function(d,i) {
            if(parameters['patternType'+i] == 0){

                return  'url(#'+textureID+'_linePattern' + i +')'
            }
            if(parameters['patternType'+i] == 1){
                return  'url(#'+textureID+'_dotPattern' + i +')'
            }
            if(parameters['patternType'+i] == 2){
                return  'url(#'+textureID+'_gridPattern' + i +')'
            }})
        .attr('stroke','black')
        .attr('stroke-width', parameters['outline'])
// })
}

function drawIconBarWithTextureFromParameters(data, chart, width, height, parameters, textureID){

    let barsResults = drawBar('#'+chart, width, height, data) //get the results from drawBar(), because this function will return two values
    let bars = barsResults[0]

    bars
        .attr('stroke', 'black')
        .attr('stroke-width', parameters['outline'])
        .attr('fill', function(d,i) {

            return  'url(#'+textureID+'_iconPattern' + i +')'
        })
}

/**
 * draw a pie chart with geometric texture from a set of given parameters
 * @param dataset
 * @param r - radius of the pie chart
 * @param chart - part of the ID of the <div> which we will append the pie chart to
 * @param parameters - parameters of the texture set
 * @param textureID - ID of the texture set
 */
function drawGeoPieWithTextureFromParameters(data,chart, radius, parameters, textureID){

    //grid pattern needs two lines, A is for one of them
    //arcA: pie chart with one line of grid pattern texture
    let arcA = drawPie('#'+chart+'A',radius,data, true)
    arcA
        .attr('fill', function(d,i) {
            return  'url(#'+textureID+'_gridPatternA' + i +")"})

    //main pie chart
    let arc = drawPie('#'+chart,radius,data, true)
    arc
        .attr('fill', function(d,i) {
            if(parameters['patternType'+i] == 0){ //line
                return  'url(#'+textureID+'_linePattern' + i +')'
            }
            if(parameters['patternType'+i] == 1){ //dot
                return  'url(#'+textureID+'_dotPattern' + i +')'
            }
            if(parameters['patternType'+i] == 2){ //grid
                return  'url(#'+textureID+'_gridPattern' + i +')'
            }})
        .attr('stroke','none')
        // .attr('stroke-width', parameters['outline'])


    //pie for the white halo
    let arcWhiteStroke = drawPie('#'+chart+'WhiteStroke',radius,data, false)
    arcWhiteStroke
        .attr('stroke', 'white')
        .attr('stroke-width', parseFloat(parameters['halo']) + parseFloat(parameters['outline']))
        .attr('fill', 'none')

    //pie for the black outline
    let arcBlackStroke = drawPie('#'+chart+'BlackStroke',radius,data, false)
    arcBlackStroke
        .attr('stroke', 'black')
        .attr('stroke-width', parameters['outline'])
        .attr("fill", 'none')

}

function drawIconPieWithTextureFromParameters(data, chart, radius, parameters, textureID){
    let arc = drawPie('#'+chart, radius,data, true)
    arc
        .attr('fill', function(d,i) {
            return  'url(#'+textureID+'_iconPattern' + i +')'
        })

//white halo
    let arcWhiteStroke = drawPie('#'+chart+'WhiteStroke',radius,data, false)
    arcWhiteStroke
        .attr('stroke', 'white')
        .attr('stroke-width', parseFloat(parameters['halo']) + parseFloat(parameters['outline']))
        .attr('fill', 'none')

    let arcBlackStroke = drawPie('#'+chart+'BlackStroke',radius,data, false)
    arcBlackStroke
        .attr('stroke', 'black')
        .attr('stroke-width', parseFloat(parameters['outline']))
        .attr('fill', 'none')
}

function drawGeoMapWithTextureFromParameters(dataset, chart, d, parameters, textureID){ //chart: used for the id of the chart; d: used for the id of each department


    let chartName = 'fruit'
    // let csvName = 'random'

    let width = 600, height = 600

    let path = d3.geoPath()

    let projection = d3.geoConicConformal() // Lambert-93
        .center([2.454071, 46.279229]) // Center on France
        .scale(2600)
        .translate([width / 2 - 50, height / 2])

    path.projection(projection)

    let promises = [];
    promises.push(d3.json(filePath+'data/departments.json'))
    // promises.push(d3.csv("population.csv"));
    // for(let i = 0; i < totalCsvFile; i++){
    //     promises.push(d3.csv(filePath+'data/'+ csvName + getCsvIndex(chartName) +".csv"));
    // }
    Promise.all(promises).then(function(values) {
        let geojson = values[0] // Recovery of the first promise: the content of the JSON file
        // let csv = values[getCsvIndex(chartName)+1] // Recovery of the second promise: the content of the csv file

        let csv = dataset

        drawMap('#'+chart+'A', geojson, path, d+'A', width, height)
        drawMap('#'+chart,geojson,  path, d, width, height)
        drawMap('#'+chart+'WhiteStroke', geojson, path, d+'WhiteStroke', width, height)
        drawMap('#'+chart+'BlackStroke', geojson, path, d+'BlackStroke', width, height)

        let quantile = d3.scaleQuantile()
            .domain([0, d3.max(csv, e => +e.POP)])
            .range(d3.range(fruits.length));

        csv.forEach(function(e,i) {
            d3.select('#'+d+'A' + e.CODE_DEPT)
                .attr("fill", function(d){return  'url(#'+textureID+'_gridPatternA' + quantile(+e.POP) + ')' })

            d3.select('#'+d + e.CODE_DEPT)
                .attr('stroke', 'none')
                .attr("fill", function() {
                    if(parameters['patternType'+quantile(+e.POP)] == 0){

                        return  'url(#'+textureID+'_linePattern' + quantile(+e.POP) +')'
                    }
                    if(parameters['patternType'+quantile(+e.POP)] == 1){
                        return  'url(#'+textureID+'_dotPattern' + quantile(+e.POP) +')'
                    }
                    if(parameters['patternType'+quantile(+e.POP)] == 2){
                        return  'url(#'+textureID+'_gridPattern' + quantile(+e.POP) +')'
                    }})

            d3.select('#'+d+'WhiteStroke' + e.CODE_DEPT)
                .attr('fill','none')
                .attr('stroke', 'white')
                .attr('stroke-width', parseFloat(parameters['halo']) + parseFloat(parameters['outline']))

            d3.select('#'+d+'BlackStroke' + e.CODE_DEPT)
                .attr('fill','none')
                .attr('stroke', 'black')
                .attr('stroke-width', parameters['outline'])
        })

    })
}

function drawIconMapWithTextureFromParameters(dataset, chart, d, parameters, textureID){ //chart: used for the id of the chart; d: used for the id of each department

    let chartName = 'fruit'
    // let csvName = 'random'

    let width = 600, height = 600;

    let path = d3.geoPath()

    let projection = d3.geoConicConformal() // Lambert-93
        .center([2.454071, 46.279229]) // Center on France
        .scale(2600)
        .translate([width / 2 - 50, height / 2])

    path.projection(projection);

    let promises = []
    promises.push(d3.json(filePath+'data/departments.json'))
    // promises.push(d3.csv("population.csv"))
    // for(i = 0;i<totalCsvFile;i++){
    //     promises.push(d3.csv(filePath+'data/'+csvName + getCsvIndex(chartName) +".csv"))
    // }


    Promise.all(promises).then(function(values) {
        let geojson = values[0]; // Recovery of the first promise: the content of the JSON file
        // let csv = values[getCsvIndex(chartName)+1]; // Recovery of the second promise: the content of the csv file

        let csv = dataset

        let deps = drawMap('#'+chart,geojson,  path, d, width,height)
        drawMap('#'+chart+'WhiteStroke', geojson, path, d+'WhiteStroke', width,height)
        drawMap('#'+chart+'BlackStroke', geojson, path, d+'BlackStroke', width,height)

        let quantile = d3.scaleQuantile()
            .domain([0, d3.max(csv, e => +e.POP)])
            .range(d3.range(fruits.length)); // number of categories

        let defs = iconTextures(deps, fruits)


        csv.forEach(function(e,i) {

            d3.select('#'+d + e.CODE_DEPT)
                .attr('stroke', 'none')
                .attr("fill", function(d, i){return  'url(#'+textureID+'_iconPattern' + quantile(+e.POP) + ')' })

            d3.select('#'+d+'WhiteStroke' + e.CODE_DEPT)
                .attr('fill','none')
                .attr('stroke', 'white')
                .attr('stroke-width', parseFloat(parameters['halo']) + parseFloat(parameters['outline']))

            d3.select('#'+d+'BlackStroke' + e.CODE_DEPT)
                .attr('fill','none')
                .attr('stroke', 'black')
                .attr('stroke-width', parameters['outline'])

        })

    })
}

/** interface functions */
/**
 * undo one step of texture parameter change
 * can be used for all charts (bar, geo, map) and both textures (geometric and iconic texture)
 * @param chartName
 */
function undo(chartName){
    //get point
    let pointer
    //if we have not set point
    if(localStorage.getItem(chartName+'pointer') == null){
        //set it to 0, and we cannot use undo function
        pointer = 0
    }else{
        //if we already saved point in the localStorage, we get it
        pointer = Number(localStorage.getItem(chartName+'pointer'))
    }

    //we can only use undo function when point > 0
    if(pointer > 0){
        //we move the pointer one step to the left
        pointer = pointer - 1
        //and update it to localStorage
        localStorage.setItem(chartName+'pointer', pointer)

        //we get parametersList from localStorage
        let parametersList = JSON.parse(localStorage.getItem(chartName+'parametersList') || '[]')
        if(parametersList.length > 0){
            //we get the parameters that is pointed by the pointer
            parameters = parametersList[pointer]

            //we redraw the textures of all categories, based on the new parameters
            for(let i = 0; i < fruits.length; i++){
                //since geometric texture and iconic texture have different parameters set, here we need to distinguish them
                if(chartName.endsWith('Geo')){
                    console.log('geo redo')
                    //draw textures for category i
                    geo_getParameters(i)
                    geo_setCatPattern(i)
                }
                if(chartName.endsWith('Icon')){
                    console.log('icon redo')
                    //draw textures for category i
                    icon_getParameters(i)
                    icon_setCatPattern(i, patternSize)
                }
            }

            let controlOutline = document.getElementById('controlOutline')
            controlOutline.value = parameters['outline']

            if(document.getElementById('halo')){
                let controlHalo = document.getElementById('controlHalo')
                controlHalo.value = parameters['halo']
            }
            drawOutline('chart_outline', parameters['outline'], 'chart_halo', parameters['halo'])
        }
    }else{
        console.log('cannot undo, because the pointer is:'+pointer)
        alert('cannot undo')
    }
}

/**
 * redo one step of texture parameter change
 * can be used for all charts (bar, geo, map) and both textures (geometric and iconic texture)
 * @param chartName
 */
function redo(chartName){
    //we get the pointer for localStorage
    if(localStorage.getItem(chartName+'pointer')){
        let pointer = Number(localStorage.getItem(chartName+'pointer'))

        //we get the parametersList from localStorage
        let parametersList = JSON.parse(localStorage.getItem(chartName+'parametersList') || '[]')
        //we can only do redo when pointer is not point to the last element of the parametersList (parametersList[parametersList.length-1])
        if(pointer < parametersList.length-1){
            if(parametersList.length > 0){
                //We move the pointer one step to the right
                pointer = pointer + 1
                localStorage.setItem(chartName+'pointer', pointer)

                //we get the parameters that is pointed by the pointer
                parameters = parametersList[pointer]

                //we redraw the textures of all categories, based on the new parameters
                for(let i = 0; i < fruits.length; i++){
                    //since geometric texture and iconic texture have different parameters set, here we need to distinguish them
                    if(chartName.endsWith('Geo')){
                        //draw textures for category i
                        geo_getParameters(i)
                        geo_setCatPattern(i)
                    }
                    if(chartName.endsWith('Icon')){
                        //draw textures for category i
                        icon_getParameters(i)
                        icon_setCatPattern(i, patternSize)
                    }
                }
                let controlOutline = document.getElementById('controlOutline')
                controlOutline.value = parameters['outline']

                if(document.getElementById('halo')){
                    let controlHalo = document.getElementById('controlHalo')
                    controlHalo.value = parameters['halo']
                }
                drawOutline('chart_outline', parameters['outline'], 'chart_halo', parameters['halo'])
            }
        }else{
            alert('cannot redo')
        }
    }else{
        alert('cannot redo')
    }


}

// function icon_redo(chartName){
//     let pointer = Number(localStorage.getItem(chartName+'pointer'))
//     pointer = pointer + 1
//     console.log('pointer', pointer)
//     localStorage.setItem(chartName+'pointer', pointer)
//     let parametersList = JSON.parse(localStorage.getItem(chartName+'parametersList') || '[]')
//     if(pointer < parametersList.length){
//         if(parametersList.length > 0){
//             parameters = parametersList[pointer]
//             for(let i = 0; i < fruits.length; i++){
//                 icon_getParameters(i)
//                 icon_setCatPattern(i, patternSize)
//             }
//             controlOutline.value = parameters['outline']
//             if(controlHalo){
//                 controlHalo.value = parameters['halo']
//             }
//         }
//     }else{
//         alert('cannot redo')
//     }
// }

/**
 * If a checkbox for same for all categories are clicked, record its status to localStorage
 * @param chartName
 */
function setSameCheckboxesStatus(chartName){
    let same = document.getElementsByClassName('same')
    for(let i = 0; i < same.length; i++){
        same[i].onclick = function(){
            if(same[i].checked == true){
                localStorage.setItem(chartName+ "same"+i, 1)
            }
            if(same[i].checked == false){
                localStorage.setItem(chartName+ "same"+i, 0)
            }
        }
    }
}

function getSameCheckboxesStatus(chartName){
    for(let i = 0; i < same.length; i++){
        if(Number(localStorage.getItem(chartName + "same"+i)) == 1){
            same[i].checked = true
        }else{
            same[i].checked = false
        }
    }
}

/** geometric texture editing functions */
//set pattern parameter for i-th category
function geo_setCatPattern(i){
    //all pattern controllersDiv
    let lineControllersDiv = document.getElementById("lineControllersDiv")
    let dotControllersDiv = document.getElementById("dotControllersDiv")
    let gridControllersDiv = document.getElementById("gridControllersDiv")

    switch(patternType[i]){
        case 0: //pattern type: line texture

            //get elements of i-th line pattern
            // getLinePattern(i)
            lineControllersDiv.style.display = "block"
            dotControllersDiv.style.display = "none"
            gridControllersDiv.style.display = "none"

            //set the fill of i-th category elements to line textures
            d3.selectAll(".category"+i+":not(text)") // select by class
                .attr("fill", "url(#linePattern" + i + ")")

            let linePattern = document.getElementById("linePattern"+i);
            let linePatternLine = document.getElementById("linePattern"+i+"Line0")
            let linePatternBackground = document.getElementById("linePattern" + i +"Background")

            //set the parameters of the line texture according to controllers' values
            linePattern.setAttribute("patternTransform", "translate(" + controlLineX.value+","+controlLineY.value+") rotate("+controlLineRotate.value+")")

            linePattern.setAttribute("width", controlLineDensity.value)
            linePattern.setAttribute("height", controlLineDensity.value)

            linePatternLine.setAttribute("stroke-width", controlLineStrokeWidth.value)
            linePatternLine.setAttribute("transform", "translate(0," + controlLineDensity.value/2+")")

            controlLineStrokeWidth.max = controlLineDensity.value * overlap_ratio

            controlLineBackgroundRadios[lineBackground[i]].checked = true
            if(controlLineBackgroundBlack.checked){
                linePatternBackground.setAttribute("fill", "black")
                linePatternLine.setAttribute("stroke", "white")
                lineBackground[i] = 1
            }else if(controlLineBackgroundWhite.checked){
                linePatternBackground.setAttribute("fill", "white")
                linePatternLine.setAttribute("stroke", "black")
                lineBackground[i] = 0
            }
            geo_setParameters(i)
            break

        case 1: //pattern type: dot texture

            //get elements of i-th line pattern
            // getDotPattern(i)
            lineControllersDiv.style.display = "none"
            dotControllersDiv.style.display = "block"
            gridControllersDiv.style.display = "none"

            //set the fill of i-th category elements to dot textures
            d3.selectAll(".category"+i+":not(text)") //we add ":not(text)" to avoid fill texture to the legend labels
                .attr("fill", "url(#dotPattern" + i + ")")

            let dotPattern = document.getElementById("dotPattern"+i)
            let dotPatternCircle = document.getElementById("dotPattern"+i+"Circle0")
            let dotPatternBackground = document.getElementById("dotPattern" + i +"Background")

            //set the parameters of the dot texture according to controllers' values
            dotPattern.setAttribute("patternTransform", "translate(" + controlDotX.value+","+controlDotY.value+") rotate("+controlDotRotate.value+")")
            dotPattern.setAttribute("width", controlDotDensity.value)
            dotPattern.setAttribute("height", controlDotDensity.value)
            dotPatternCircle.setAttribute("r", controlDotSize.value)
            dotPatternCircle.setAttribute("cx", controlDotDensity.value/2)
            dotPatternCircle.setAttribute("cy", controlDotDensity.value/2)
            dotPatternCircle.setAttribute("stroke-width", controlDotPrimitiveStrokeWidth.value)

            //update the Size Controller value and write them into localStorage
            controlDotSize.max = controlDotDensity.value/2 * overlap_ratio

            controlDotBackgroundRadios[dotBackground[i]].checked = true

            if(controlDotBackgroundBlack.checked){
                dotPatternBackground.setAttribute("fill", "black")
                dotPatternCircle.setAttribute("fill", "white")
                dotPatternCircle.setAttribute("stroke", "white")
                dotBackground[i] = 1
            }else if(controlDotBackgroundWhite.checked){
                dotPatternBackground.setAttribute("fill", "white")
                dotPatternCircle.setAttribute("fill", "black")
                dotPatternCircle.setAttribute("stroke", "black")
                dotBackground[i] = 0
            }

            controlDotPrimitiveRadios[dotPrimitive[i]].checked = true

            if(controlDotPrimitiveDot.checked){
                dotPatternCircle.setAttribute("fill-opacity", 1)
                dotPatternCircle.setAttribute("stroke-opacity", 0)
                document.getElementById("controlDotPrimitiveStrokeWidthDiv").style.display = "none"
            }

            if(controlDotPrimitiveCircle.checked){
                dotPatternCircle.setAttribute("fill-opacity", 0)
                dotPatternCircle.setAttribute("stroke-opacity", 1)
                document.getElementById("controlDotPrimitiveStrokeWidthDiv").style.display = "block"
            }

            controlDotPrimitiveStrokeWidth.max = controlDotSize.value * 2 * overlap_ratio

            geo_setParameters(i)
            break

        case 2:
            // getGridPattern(i)
            lineControllersDiv.style.display = "none"
            dotControllersDiv.style.display = "none"
            gridControllersDiv.style.display = "block"

            //set the fill of i-th category elements to dot textures
            d3.selectAll(".category"+i+":not(text)")
                .attr("fill", "url(#gridPattern" + i + ")")


            let gridPattern = document.getElementById("gridPattern"+ i)
            let gridPatternLine= document.getElementById("gridPattern"+i+"Line0")

            let gridPatternA = document.getElementById("gridPatternA"+ i)
            let gridPatternALine= document.getElementById("gridPatternA"+i+"Line0")

            let gridPatternBackground = document.getElementById("gridPattern" + i +"Background")

            //set the parameters of the grid texture according to controllers' values
            gridPattern.setAttribute("width", controlGridDensity.value)
            gridPattern.setAttribute("height", controlGridDensity.value)

            gridPatternLine.setAttribute("stroke-width", controlGridStrokeWidth.value)

            gridPatternLine.setAttribute("transform", "translate(0," + controlGridDensity.value/2+")")

            gridPattern.setAttribute("patternTransform", "translate(" + controlGridX.value+","+controlGridY.value+") rotate("+(parseFloat(controlGridAngle.value) + parseFloat(controlGridRotate.value) )+")")

            //set the parameters of the grid texture according to controllers' values
            gridPatternA.setAttribute("width", controlGridDensity.value)
            gridPatternA.setAttribute("height", controlGridDensity.value)

            gridPatternALine.setAttribute("stroke-width", controlGridStrokeWidth.value)
            gridPatternALine.setAttribute("transform", "translate(0," + controlGridDensity.value/2+")")

            gridPatternA.setAttribute("patternTransform", "translate(" + controlGridX.value+","+controlGridY.value+") rotate("+(180 - parseFloat(controlGridAngle.value) + parseFloat(controlGridRotate.value))+")")


            controlGridStrokeWidth.max = controlGridDensity.value

            controlGridBackgroundRadios[gridBackground[i]].checked = true

            if(controlGridBackgroundBlack.checked){
                gridPatternBackground.setAttribute("fill", "black")
                gridPatternLine.setAttribute("stroke", "white")
                gridPatternALine.setAttribute("stroke", "white")
                gridBackground[i] = 1
            }else if(controlGridBackgroundWhite.checked){
                gridPatternBackground.setAttribute("fill", "white")
                gridPatternLine.setAttribute("stroke", "black")
                gridPatternALine.setAttribute("stroke", "black")
                gridBackground[i] = 0
            }

            geo_setParameters(i)
            break
    }
}

/**
 * draw outline and halo for charts
 * use it when you have changed the parameters for outline or halo, and want the change to be shown on the screen. (e.g., when controlOutline.oninput or controlHalo.oninput)
 * @param chart_outline_class class name of the black strokes (the chart's outline)
 * @param outlineValue
 * @param chart_halo_class class name of the white strokes (the chart's white halo)
 * @param haloValue
 */
function drawOutline(chart_outline_class, outlineValue, chart_halo_class,haloValue){
    let chart_outline = document.getElementsByClassName(chart_outline_class)

    //if the chart does not have halo (e.g., bar chart), we chart_halo will be an empty list
    let chart_halo = document.getElementsByClassName(chart_halo_class)

    for(let i = 0; i < chart_outline.length; i++){
        chart_outline[i].setAttribute('stroke-width', parseFloat(outlineValue))
        if(chart_halo.length > 0){
            chart_halo[i].setAttribute('stroke-width', parseFloat(outlineValue) + parseFloat(haloValue))
        }

    }
}

//set i-th category as the target for all texture parameter controllers + set controllers value
function geo_selectCat(i){
    console.log('select cat:'+i)

    //update the text for fruit indicator
    let fruitName = document.getElementById('fruitName')
    fruitName.innerHTML = fruits[i]

    //pattern type
    for(let j = 0; j < patternTypeRadios.length; j++){
        patternTypeRadios[j].onclick = function(){
            //if same pattern type checkbox is checked, set pattern type to all categories
            if(document.getElementById("samePatternType").checked == true){

                //iterate over all categories
                for(let k = 0; k < fruits.length; k++){ //k:each category of fruits
                    patternType[k] = j
                    geo_setCatPattern(k)
                }
            }

            //if same pattern type checkbox is not checked, only set the pattern type to the selected category
            if(document.getElementById("samePatternType").checked == false){
                patternType[i] = j
                geo_setCatPattern(i)
            }

            addParametersToList(chartName, parameters)
        }
    }

    //set pattern type radio status
    patternTypeRadios[patternType[i]].checked = true

    //line texture controller
    for(let j = 0; j < lineControllers.length; j++){
        lineControllers[j].onchange = function(){
            addParametersToList(chartName, parameters)
            revisitPostParameters(chartName, parameters, trrack, action)
        }
    }

    controlLineDensity.oninput = function(){
        controlLineStrokeWidth.max = controlLineDensity.value

        if(document.getElementById("sameLineDensity").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePattern = document.getElementById("linePattern"+k)
                let linePatternLine = document.getElementById("linePattern"+k+"Line0")

                linePattern.setAttribute("width", controlLineDensity.value)
                linePattern.setAttribute("height", controlLineDensity.value)

                linePatternLine.setAttribute("transform", "translate(0," + controlLineDensity.value/2+")")

                parameters["linePattern"+k+"Density"] = controlLineDensity.value
                parameters["linePattern"+k+"StrokeWidthMax"] = controlLineStrokeWidth.max
            }
        }

        if(document.getElementById("sameLineDensity").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlLineStrokeWidth.oninput = function(){
        if(document.getElementById("sameLineStrokeWidth").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePatternLine = document.getElementById("linePattern"+k+"Line0")

                linePatternLine.setAttribute("stroke-width", controlLineStrokeWidth.value)

                parameters["linePattern"+k+"StrokeWidth"] = controlLineStrokeWidth.value
            }
        }

        if(document.getElementById("sameLineStrokeWidth").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlLineX.oninput = function(){

        if(document.getElementById("sameLineX").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePattern = document.getElementById("linePattern"+k)

                let linePatternTransform = linePattern.getAttribute("patternTransform")
                let s1 = linePatternTransform.slice(linePatternTransform.indexOf(',') + 1)
                linePattern.setAttribute('patternTransform', 'translate('+controlLineX.value+','+s1)

                parameters["linePattern"+k+"X"] = controlLineX.value
            }
        }

        if(document.getElementById("sameLineX").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlLineY.oninput = function(){
        if(document.getElementById("sameLineY").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePattern = document.getElementById("linePattern"+k)

                let linePatternTransform = linePattern.getAttribute("patternTransform")
                let s1 = linePatternTransform.slice(0, linePatternTransform.indexOf(','))
                let s2 = linePatternTransform.slice(linePatternTransform.indexOf(')') + 1)
                linePattern.setAttribute('patternTransform', s1+','+controlLineY.value+')'+s2)

                parameters["linePattern"+k+"Y"] = controlLineY.value
            }
        }

        if(document.getElementById("sameLineY").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlLineRotate.oninput = function(){
        if(document.getElementById("sameLineRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePattern = document.getElementById("linePattern"+k)
                let linePatternTransform = linePattern.getAttribute("patternTransform")
                let s1 = linePatternTransform.split('(')[0]
                let s2 = linePatternTransform.split('(')[1]
                linePattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +controlLineRotate.value+')')

                parameters["linePattern"+k+"Rotate"] = controlLineRotate.value
            }
        }

        if(document.getElementById("sameLineRotate").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }




    controlLineAngle0.onclick = function(){
        controlLineRotate.value = 0

        if(document.getElementById("sameLineRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePattern = document.getElementById("linePattern"+k)
                let linePatternTransform = linePattern.getAttribute("patternTransform")
                let s1 = linePatternTransform.split('(')[0]
                let s2 = linePatternTransform.split('(')[1]
                linePattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +controlLineRotate.value+')')

                parameters["linePattern"+k+"Rotate"] = controlLineRotate.value
            }
        }

        if(document.getElementById("sameLineRotate").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlLineAngle45.onclick = function(){
        controlLineRotate.value = 45

        if(document.getElementById("sameLineRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePattern = document.getElementById("linePattern"+k)
                let linePatternTransform = linePattern.getAttribute("patternTransform")
                let s1 = linePatternTransform.split('(')[0]
                let s2 = linePatternTransform.split('(')[1]
                linePattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +controlLineRotate.value+')')

                parameters["linePattern"+k+"Rotate"] = controlLineRotate.value
            }
        }

        if(document.getElementById("sameLineRotate").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlLineAngle90.onclick = function(){
        controlLineRotate.value = 90

        if(document.getElementById("sameLineRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePattern = document.getElementById("linePattern"+k)
                let linePatternTransform = linePattern.getAttribute("patternTransform")
                let s1 = linePatternTransform.split('(')[0]
                let s2 = linePatternTransform.split('(')[1]
                linePattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +controlLineRotate.value+')')

                parameters["linePattern"+k+"Rotate"] = controlLineRotate.value
            }
        }

        if(document.getElementById("sameLineRotate").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlLineAngle135.onclick = function(){
        controlLineRotate.value = 135

        if(document.getElementById("sameLineRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePattern = document.getElementById("linePattern"+k)
                let linePatternTransform = linePattern.getAttribute("patternTransform")
                let s1 = linePatternTransform.split('(')[0]
                let s2 = linePatternTransform.split('(')[1]
                linePattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +controlLineRotate.value+')')

                parameters["linePattern"+k+"Rotate"] = controlLineRotate.value
            }
        }

        if(document.getElementById("sameLineRotate").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlLineBackgroundWhite.onclick = function(){
        lineBackground[i] = 0

        if(document.getElementById("sameLineBackground").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePatternLine = document.getElementById("linePattern"+k+"Line0")
                let linePatternBackground = document.getElementById("linePattern" + k +"Background")

                linePatternBackground.setAttribute("fill", "white")
                linePatternLine.setAttribute("stroke", "black")

                parameters["linePattern"+i+"Background"] = lineBackground[i]
            }
        }

        if(document.getElementById("sameLineBackground").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlLineBackgroundBlack.onclick = function(){
        lineBackground[i] = 1

        if(document.getElementById("sameLineBackground").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let linePatternLine = document.getElementById("linePattern"+k+"Line0")
                let linePatternBackground = document.getElementById("linePattern" + k +"Background")

                linePatternBackground.setAttribute("fill", "black")
                linePatternLine.setAttribute("stroke", "white")

                parameters["linePattern"+i+"Background"] = lineBackground[i]
            }
        }

        if(document.getElementById("sameLineBackground").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }


    //dot texture controller
    for(let j = 0; j < dotControllers.length; j++){
        // dotControllers[j].oninput = function(){
        //     geo_setCatPattern(i)
        // }

        dotControllers[j].onchange = function(){
            addParametersToList(chartName, parameters)
            revisitPostParameters(chartName, parameters, trrack, action)
        }
    }

    controlDotDensity.oninput = function(){


        if(document.getElementById("sameDotDensity").checked == true){
            controlDotSize.max = controlDotDensity.value/2 * overlap_ratio

            for(let k = 0; k < fruits.length; k++){
                let dotPattern = document.getElementById("dotPattern"+k)
                let dotPatternCircle = document.getElementById("dotPattern"+k+"Circle0")

                dotPattern.setAttribute("width", controlDotDensity.value)
                dotPattern.setAttribute("height", controlDotDensity.value)

                dotPatternCircle.setAttribute("cx", controlDotDensity.value/2)
                dotPatternCircle.setAttribute("cy", controlDotDensity.value/2)

                parameters["dotPattern"+k+"Density"] = controlDotDensity.value
                parameters["dotPattern"+k+"SizeMax"] = controlDotSize.max
            }
        }

        if(document.getElementById("sameDotDensity").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDotSize.oninput = function(){

        if(document.getElementById("sameDotSize").checked == true){
            controlDotPrimitiveStrokeWidth.max = controlDotSize.value * 2 * overlap_ratio

            for(let k = 0; k < fruits.length; k++){

                let dotPatternCircle = document.getElementById("dotPattern"+k+"Circle0")
                dotPatternCircle.setAttribute("r", controlDotSize.value)

                parameters["dotPattern"+k+"Size"] = controlDotSize.value
            }
        }

        if(document.getElementById("sameDotSize").checked == false){
            geo_setCatPattern(i)
        }

        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDotRotate.oninput = function(){

        if(document.getElementById("sameDotRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("dotPattern"+k)
                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +controlDotRotate.value+')')

                parameters["dotPattern"+k+"Rotate"] = controlDotRotate.value
            }
        }

        if(document.getElementById("sameDotRotate").checked == false){
            geo_setCatPattern(i)
        }

        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDotAngle0.onclick = function(){
        controlDotRotate.value = 0

        if(document.getElementById("sameDotRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("dotPattern"+k)
                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +controlDotRotate.value+')')

                parameters["dotPattern"+k+"Rotate"] = controlDotRotate.value
            }
        }

        if(document.getElementById("sameDotRotate").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDotAngle45.onclick = function(){
        controlDotRotate.value = 45

        if(document.getElementById("sameDotRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("dotPattern"+k)
                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +controlDotRotate.value+')')

                parameters["dotPattern"+k+"Rotate"] = controlDotRotate.value
            }
        }

        if(document.getElementById("sameDotRotate").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }



    controlDotBackgroundWhite.onclick = function(){
        dotBackground[i] = 0

        if(document.getElementById("sameDotBackground").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let dotPatternCircle = document.getElementById("dotPattern"+k+"Circle0")
                let dotPatternBackground = document.getElementById("dotPattern" + k +"Background")


                dotPatternBackground.setAttribute("fill", "white")
                dotPatternCircle.setAttribute("fill", "black")
                dotPatternCircle.setAttribute("stroke", "black")

                parameters["dotPattern"+k+"Background"] = dotBackground[i]
            }
        }

        if(document.getElementById("sameDotBackground").checked == false){
            geo_setCatPattern(i)
        }


        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDotBackgroundBlack.onclick = function(){
        dotBackground[i] = 1

        if(document.getElementById("sameDotBackground").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let dotPatternCircle = document.getElementById("dotPattern"+k+"Circle0")
                let dotPatternBackground = document.getElementById("dotPattern" + k +"Background")

                dotPatternBackground.setAttribute("fill", "black")
                dotPatternCircle.setAttribute("fill", "white")
                dotPatternCircle.setAttribute("stroke", "white")

                parameters["dotPattern"+k+"Background"] = dotBackground[i]
            }
        }

        if(document.getElementById("sameDotBackground").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDotPrimitiveDot.onclick = function(){
        dotPrimitive[i] = 0

        if(document.getElementById("sameDotPrimitive").checked == true){
            document.getElementById("controlDotPrimitiveStrokeWidthDiv").style.display = "none"
            for(let k = 0; k < fruits.length; k++){
                let dotPatternCircle = document.getElementById("dotPattern"+k+"Circle0")

                dotPatternCircle.setAttribute("fill-opacity", 1)
                dotPatternCircle.setAttribute("stroke-opacity", 0)

                parameters["dotPattern"+k+"Primitive"] = dotPrimitive[i]
            }
        }

        if(document.getElementById("sameDotPrimitive").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDotPrimitiveCircle.onclick = function(){
        dotPrimitive[i] = 1

        if(document.getElementById("sameDotPrimitive").checked == true){
            document.getElementById("controlDotPrimitiveStrokeWidthDiv").style.display = "block"
            for(let k = 0; k < fruits.length; k++){
                let dotPatternCircle = document.getElementById("dotPattern"+k+"Circle0")

                dotPatternCircle.setAttribute("fill-opacity", 0)
                dotPatternCircle.setAttribute("stroke-opacity", 1)

                parameters["dotPattern"+i+"Primitive"] = dotPrimitive[i]
            }
        }

        if(document.getElementById("sameDotPrimitive").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
    }

    controlDotPrimitiveStrokeWidth.oninput = function(){

        if(document.getElementById("sameDotPrimitiveStrokeWidth").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let dotPatternCircle = document.getElementById("dotPattern"+k+"Circle0")
                dotPatternCircle.setAttribute("stroke-width", controlDotPrimitiveStrokeWidth.value)

                parameters["dotPattern"+k+"PrimitiveStrokeWidth"] = controlDotPrimitiveStrokeWidth.value
            }
        }

        if(document.getElementById("sameDotPrimitiveStrokeWidth").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDotX.oninput = function(){

        if(document.getElementById("sameDotX").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let dotPattern = document.getElementById("dotPattern"+k)

                let patternTransform = dotPattern.getAttribute("patternTransform")
                let s1 = patternTransform.slice(patternTransform.indexOf(',') + 1)
                dotPattern.setAttribute('patternTransform', 'translate('+controlDotX.value+','+s1)

                parameters["dotPattern"+k+"X"] = controlDotX.value
            }
        }

        if(document.getElementById("sameDotX").checked == false){
            geo_setCatPattern(i)
        }

        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDotY.oninput = function(){
        if(document.getElementById("sameDotY").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let dotPattern = document.getElementById("dotPattern"+k)

                let patternTransform = dotPattern.getAttribute("patternTransform")
                let s1 = patternTransform.slice(0, patternTransform.indexOf(','))
                let s2 = patternTransform.slice(patternTransform.indexOf(')') + 1)
                dotPattern.setAttribute('patternTransform', s1+','+controlDotY.value+')'+s2)

                parameters["dotPattern"+k+"Y"] = controlDotY.value
            }
        }

        if(document.getElementById("sameDotY").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    //grid texture controller
    for(let j = 0; j < gridControllers.length; j++){
        // gridControllers[j].oninput = function(){
        //     geo_setCatPattern(i)
        // }

        gridControllers[j].onchange = function(){
            addParametersToList(chartName, parameters)
            revisitPostParameters(chartName, parameters, trrack, action)
        }
    }

    controlGridDensity.oninput = function(){
        controlGridStrokeWidth.max = controlGridDensity.value

        if(document.getElementById("sameGridDensity").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let gridPattern = document.getElementById("gridPattern"+ k)
                let gridPatternLine= document.getElementById("gridPattern"+k+"Line0")

                let gridPatternA = document.getElementById("gridPatternA"+ k)
                let gridPatternALine= document.getElementById("gridPatternA"+k+"Line0")

                gridPattern.setAttribute("width", controlGridDensity.value)
                gridPattern.setAttribute("height", controlGridDensity.value)

                gridPatternLine.setAttribute("transform", "translate(0," + controlGridDensity.value/2+")")

                gridPatternA.setAttribute("width", controlGridDensity.value)
                gridPatternA.setAttribute("height", controlGridDensity.value)

                gridPatternALine.setAttribute("transform", "translate(0," + controlGridDensity.value/2+")")

                parameters["gridPattern"+k+"Density"] = controlGridDensity.value
                parameters["gridPattern"+k+"StrokeWidthMax"] = controlGridStrokeWidth.max
            }
        }

        if(document.getElementById("sameGridDensity").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridStrokeWidth.oninput = function(){
        if(document.getElementById("sameGridStrokeWidth").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let gridPatternLine= document.getElementById("gridPattern"+k+"Line0")
                let gridPatternALine= document.getElementById("gridPatternA"+k+"Line0")

                gridPatternLine.setAttribute("stroke-width", controlGridStrokeWidth.value)
                gridPatternALine.setAttribute("stroke-width", controlGridStrokeWidth.value)

                parameters["gridPattern"+k+"StrokeWidth"] = controlGridStrokeWidth.value
            }
        }

        if(document.getElementById("sameGridStrokeWidth").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridAngle.oninput = function(){
        if(document.getElementById("sameGridAngle").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("gridPattern"+ k)
                let patternA = document.getElementById('gridPatternA' + k)
                let rotate = parameters['gridPattern'+k+'Rotate']


                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(parseFloat(controlGridAngle.value) + parseFloat(rotate) )+')')
                patternA.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(180 - parseFloat(controlGridAngle.value) + parseFloat(rotate) )+')')

                parameters["gridPattern"+k+"Angle"] = controlGridAngle.value
            }
        }

        if(document.getElementById("sameGridAngle").checked == false){
            geo_setCatPattern(i)
        }

        revisitPostParameters(chartName, parameters, trrack, action)
    }



    controlGridAngle15.onclick = function(){
        controlGridAngle.value = 15

        if(document.getElementById("sameGridAngle").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("gridPattern"+ k)
                let patternA = document.getElementById('gridPatternA' + k)
                let rotate = parameters['gridPattern'+k+'Rotate']


                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(parseFloat(controlGridAngle.value) + parseFloat(rotate) )+')')
                patternA.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(180 - parseFloat(controlGridAngle.value) + parseFloat(rotate) )+')')

                parameters["gridPattern"+k+"Angle"] = controlGridAngle.value
            }
        }

        if(document.getElementById("sameGridAngle").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridAngle30.onclick = function(){
        controlGridAngle.value = 30

        if(document.getElementById("sameGridAngle").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("gridPattern"+ k)
                let patternA = document.getElementById('gridPatternA' + k)
                let rotate = parameters['gridPattern'+k+'Rotate']


                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(parseFloat(controlGridAngle.value) + parseFloat(rotate) )+')')
                patternA.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(180 - parseFloat(controlGridAngle.value) + parseFloat(rotate) )+')')

                parameters["gridPattern"+k+"Angle"] = controlGridAngle.value
            }
        }

        if(document.getElementById("sameGridAngle").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridAngle45.onclick = function(){
        controlGridAngle.value = 45

        if(document.getElementById("sameGridAngle").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("gridPattern"+ k)
                let patternA = document.getElementById('gridPatternA' + k)
                let rotate = parameters['gridPattern'+k+'Rotate']


                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(parseFloat(controlGridAngle.value) + parseFloat(rotate) )+')')
                patternA.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(180 - parseFloat(controlGridAngle.value) + parseFloat(rotate) )+')')

                parameters["gridPattern"+k+"Angle"] = controlGridAngle.value
            }
        }

        if(document.getElementById("sameGridAngle").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridRotate.oninput = function(){
        if(document.getElementById("sameGridRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("gridPattern"+ k)
                let patternA = document.getElementById('gridPatternA' + k)
                let angle = parameters['gridPattern'+k+'Angle']


                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(parseFloat(angle) + parseFloat(controlGridRotate.value) )+')')
                patternA.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(180 - parseFloat(angle) + parseFloat(controlGridRotate.value) )+')')

                parameters["gridPattern"+k+"Rotate"] = controlGridRotate.value
            }
        }

        if(document.getElementById("sameGridRotate").checked == false){
            geo_setCatPattern(i)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }


    controlGridRotate30.onclick = function(){
        controlGridRotate.value = 30

        if(document.getElementById("sameGridRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("gridPattern"+ k)
                let patternA = document.getElementById('gridPatternA' + k)
                let angle = parameters['gridPattern'+k+'Angle']


                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(parseFloat(angle) + parseFloat(controlGridRotate.value) )+')')
                patternA.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(180 - parseFloat(angle) + parseFloat(controlGridRotate.value) )+')')

                parameters["gridPattern"+k+"Rotate"] = controlGridRotate.value
            }
        }

        if(document.getElementById("sameGridRotate").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridRotate45.onclick = function(){
        controlGridRotate.value = 45

        if(document.getElementById("sameGridRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("gridPattern"+ k)
                let patternA = document.getElementById('gridPatternA' + k)
                let angle = parameters['gridPattern'+k+'Angle']


                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(parseFloat(angle) + parseFloat(controlGridRotate.value) )+')')
                patternA.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(180 - parseFloat(angle) + parseFloat(controlGridRotate.value) )+')')

                parameters["gridPattern"+k+"Rotate"] = controlGridRotate.value
            }
        }

        if(document.getElementById("sameGridRotate").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridRotate60.onclick = function(){
        controlGridRotate.value = 60

        if(document.getElementById("sameGridRotate").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let pattern = document.getElementById("gridPattern"+ k)
                let patternA = document.getElementById('gridPatternA' + k)
                let angle = parameters['gridPattern'+k+'Angle']


                let patternTransform = pattern.getAttribute("patternTransform")
                let s1 = patternTransform.split('(')[0]
                let s2 = patternTransform.split('(')[1]
                pattern.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(parseFloat(angle) + parseFloat(controlGridRotate.value) )+')')
                patternA.setAttribute('patternTransform', s1 + '(' + s2 + '(' +(180 - parseFloat(angle) + parseFloat(controlGridRotate.value) )+')')

                parameters["gridPattern"+k+"Rotate"] = controlGridRotate.value
            }
        }

        if(document.getElementById("sameGridRotate").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }


    controlGridBackgroundWhite.onclick = function(){
        gridBackground[i] = 0

        if(document.getElementById("sameGridBackground").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let gridPatternLine= document.getElementById("gridPattern"+k+"Line0")
                let gridPatternALine= document.getElementById("gridPatternA"+k+"Line0")
                let gridPatternBackground = document.getElementById("gridPattern" + k +"Background")

                gridPatternBackground.setAttribute("fill", "white")
                gridPatternLine.setAttribute("stroke", "black")
                gridPatternALine.setAttribute("stroke", "black")

                parameters["gridPattern"+k+"Background"] = gridBackground[i]
            }
        }

        if(document.getElementById("sameGridBackground").checked == false){
            geo_setCatPattern(i)
        }


        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridBackgroundBlack.onclick = function(){
        gridBackground[i] = 1

        if(document.getElementById("sameGridBackground").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let gridPatternLine= document.getElementById("gridPattern"+k+"Line0")
                let gridPatternALine= document.getElementById("gridPatternA"+k+"Line0")
                let gridPatternBackground = document.getElementById("gridPattern" +k+"Background")

                gridPatternBackground.setAttribute("fill", "black")
                gridPatternLine.setAttribute("stroke", "white")
                gridPatternALine.setAttribute("stroke", "white")

                parameters["gridPattern"+k+"Background"] = gridBackground[i]
            }
        }

        if(document.getElementById("sameGridBackground").checked == false){
            geo_setCatPattern(i)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridX.oninput = function(){

        if(document.getElementById("sameGridX").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let gridPattern = document.getElementById("gridPattern"+k)
                let gridPatternA = document.getElementById('gridPatternA'+k)

                let patternTransform = gridPattern.getAttribute("patternTransform")
                let s1 = patternTransform.slice(patternTransform.indexOf(',') + 1)

                //gridPatternA has different rotation angle as gridPattern
                let patternTransformA = gridPatternA.getAttribute("patternTransform")
                let s1A = patternTransformA.slice(patternTransformA.indexOf(',') + 1)

                gridPattern.setAttribute('patternTransform', 'translate('+controlGridX.value+','+s1)
                gridPatternA.setAttribute('patternTransform', 'translate('+controlGridX.value+','+s1A)

                parameters["gridPattern"+k+"X"] = controlGridX.value
            }
        }

        if(document.getElementById("sameGridX").checked == false){
            geo_setCatPattern(i)
        }

        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlGridY.oninput = function(){
        if(document.getElementById("sameGridY").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let gridPattern = document.getElementById("gridPattern"+k)
                let gridPatternA = document.getElementById('gridPatternA'+k)

                let patternTransform = gridPattern.getAttribute("patternTransform")
                let s1 = patternTransform.slice(0, patternTransform.indexOf(','))
                let s2 = patternTransform.slice(patternTransform.indexOf(')') + 1)

                let patternTransformA = gridPatternA.getAttribute("patternTransform")
                let s1A = patternTransformA.slice(0, patternTransformA.indexOf(','))
                let s2A = patternTransformA.slice(patternTransformA.indexOf(')') + 1)

                gridPattern.setAttribute('patternTransform', s1+','+controlGridY.value+')'+s2)
                gridPatternA.setAttribute('patternTransform', s1+','+controlGridY.value+')'+s2A)

                parameters["gridPattern"+k+"Y"] = controlGridY.value
            }
        }

        if(document.getElementById("sameDotY").checked == false){
            geo_setCatPattern(i)
        }

        revisitPostParameters(chartName, parameters, trrack, action)
    }



    geo_getParameters(i)

    controlLineBackgroundRadios[lineBackground[i]].checked = true

    controlDotBackgroundRadios[dotBackground[i]].checked = true
    controlDotPrimitiveRadios[dotPrimitive[i]].checked = true;
    controlGridBackgroundRadios[gridBackground[i]].checked = true



    geo_setCatPattern(i)

    //set color of indicator and legend
    //since the legendLabel has the class of category, it can be clicked, but it will also be filled by texture when setCatPattern. So we need to set its fill after setCatPattern function.
    for(let j = 0; j < fruits.length; j++){
        if(j == i){
            if(!chartName.startsWith("map")){
                indicators[j].setAttribute("fill", "#1E90FF") // show indicator for the selected bar
            }

            legendIndicators[j].setAttribute("fill", "#1E90FF")
            legendLabels[j].setAttribute("fill", "#1E90FF")
        }
        else{
            if(!chartName.startsWith("map")){
                indicators[j].setAttribute("fill", "none") // show indicator for the selected bar
            }
            legendIndicators[j].setAttribute("fill", "none")
            legendLabels[j].setAttribute("fill", "#000000")
        }
    }
}


//set initial parameters when the window loads
function geo_setInitialParameters(){


    //if we did not save parameters in the local storage
    if(localStorage.getItem(chartName+"parametersList") == null || JSON.parse(localStorage.getItem(chartName+"parametersList")).length === 0){
        //get the index of Bertin textures when first loading this page, and save it to local storage, for reset button
        let defaultBertinTexturesIndex = geo_defaultParameters()
        localStorage.setItem('defaultBertinTexturesIndex',defaultBertinTexturesIndex)
        document.getElementById("selectDefaultTexture").selectedIndex = defaultBertinTexturesIndex;
    }else{
        //if there are paramters in the local storage, we retrieve the parametersList
        parametersList = JSON.parse(localStorage.getItem(chartName+"parametersList") || "[]")

        //get the last item of parametersList, which is the latest paramters
        parameters = parametersList[parametersList.length - 1]

        //set parameters to patterns
        for(let i = 0; i < fruits.length; i++){
            geo_getParameters(i)
            geo_setCatPattern(i)
        }
        controlOutline.value = parameters['outline']
        if(controlHalo){
            controlHalo.value = parameters['halo']
        }
        drawOutline('chart_outline', parameters['outline'], 'chart_halo', parameters['halo'])
    }

    //set selectedCat
    if(localStorage.getItem(chartName + "_selectedCat") == null){
        geo_selectCat(0)
    }else{
        geo_selectCat(Number(localStorage.getItem(chartName + "_selectedCat")))
    }

    getSameCheckboxesStatus(chartName)
    revisitPostParameters(chartName, parameters, trrack, action)
    
}


/**
 * write the value of texture parameter controllers to the Object parameters
 * @param i - i-th category
 */
function geo_setParameters(i){
    //pattern type: line, dot or grid
    parameters["patternType"+i] = patternType[i]

    //line parameters
    parameters["linePattern"+i+"Density"] = controlLineDensity.value
    parameters["linePattern"+i+"StrokeWidth"] = controlLineStrokeWidth.value
    parameters["linePattern"+i+"StrokeWidthMax"] = controlLineStrokeWidth.max
    parameters["linePattern"+i+"X"] = controlLineX.value
    parameters["linePattern"+i+"Y"] = controlLineY.value
    parameters["linePattern"+i+"Rotate"] = controlLineRotate.value
    parameters["linePattern"+i+"Background"] = lineBackground[i]

    //dot parameters
    parameters["dotPattern"+i+"Rotate"] = controlDotRotate.value
    parameters["dotPattern"+i+"Density"] = controlDotDensity.value
    parameters["dotPattern"+i+"Size"] = controlDotSize.value
    parameters["dotPattern"+i+"SizeMax"] = controlDotSize.max
    parameters["dotPattern"+i+"X"] = controlDotX.value
    parameters["dotPattern"+i+"Y"] = controlDotY.value
    parameters["dotPattern"+i+"Background"] = dotBackground[i]
    parameters["dotPattern"+i+"Primitive"] = dotPrimitive[i]
    parameters["dotPattern"+i+"PrimitiveStrokeWidthMax"] = controlDotPrimitiveStrokeWidth.max
    parameters["dotPattern"+i+"PrimitiveStrokeWidth"] = controlDotPrimitiveStrokeWidth.value

    //grid parameters
    parameters["gridPattern"+i+"Density"] = controlGridDensity.value
    parameters["gridPattern"+i+"StrokeWidthMax"] = controlGridStrokeWidth.max
    parameters["gridPattern"+i+"StrokeWidth"] = controlGridStrokeWidth.value
    parameters["gridPattern"+i+"X"] = controlGridX.value
    parameters["gridPattern"+i+"Y"] = controlGridY.value
    parameters["gridPattern"+i+"Angle"] = controlGridAngle.value
    parameters["gridPattern"+i+"Rotate"] = controlGridRotate.value
    parameters["gridPattern"+i+"Background"] = gridBackground[i]
}

/**
 * write the value in Object parameters to texture parameter controllers
 * @param i - i-th category
 */
function geo_getParameters(i){
    //we have to put MAX before VALUE

    //pattern type: line, dot, grid
    patternType[i] = parameters["patternType"+i]

    //line
    controlLineDensity.value = parameters["linePattern"+i+"Density"]
    console.log("controlLineDensity", controlLineDensity.value)
    controlLineStrokeWidth.max = parameters["linePattern"+i+"StrokeWidthMax"]
    controlLineStrokeWidth.value = parameters["linePattern"+i+"StrokeWidth"]
    controlLineX.value = parameters["linePattern"+i+"X"]
    controlLineY.value = parameters["linePattern"+i+"Y"]
    controlLineRotate.value = parameters["linePattern"+i+"Rotate"]
    lineBackground[i] = parameters["linePattern"+i+"Background"]

    //dot
    controlDotRotate.value = parameters["dotPattern"+i+"Rotate"]
    controlDotDensity.value = parameters["dotPattern"+i+"Density"]
    controlDotSize.max = parameters["dotPattern"+i+"SizeMax"]
    controlDotSize.value = parameters["dotPattern"+i+"Size"]
    controlDotX.value = parameters["dotPattern"+i+"X"]
    controlDotY.value = parameters["dotPattern"+i+"Y"]
    dotBackground[i] = parameters["dotPattern"+i+"Background"]
    dotPrimitive[i] = parameters["dotPattern"+i+"Primitive"]
    controlDotPrimitiveStrokeWidth.max = parameters["dotPattern"+i+"PrimitiveStrokeWidthMax"]
    controlDotPrimitiveStrokeWidth.value = parameters["dotPattern"+i+"PrimitiveStrokeWidth"]

    //grid
    controlGridDensity.value = parameters["gridPattern"+i+"Density"]
    controlGridStrokeWidth.max = parameters["gridPattern"+i+"StrokeWidthMax"]
    controlGridStrokeWidth.value = parameters["gridPattern"+i+"StrokeWidth"]
    controlGridX.value = parameters["gridPattern"+i+"X"]
    controlGridY.value = parameters["gridPattern"+i+"Y"]
    controlGridAngle.value = parameters["gridPattern"+i+"Angle"]
    controlGridRotate.value = parameters["gridPattern"+i+"Rotate"]
    gridBackground[i] = parameters["gridPattern"+i+"Background"]
}

/**
 * set default geometric texture parameters to charts.
 * @returns {number} the index of the default Bertin texture set used
 */
function geo_defaultParameters(){
    parameters = {}
    for(let i = 0; i < fruits.length; i++){
        patternType[i] = 0

        controlLineDensity.value = 20
        controlLineRotate.value = 0
        controlLineStrokeWidth.value = 1
        controlLineX.value = 0
        controlLineY.value = 0
        lineBackground[i] = 0

        controlLineBackgroundWhite.checked

        controlDotRotate.value = 0
        controlDotSize.value = 5
        controlDotX.value = 0
        controlDotY.value = 0
        controlDotDensity.value = 40
        dotBackground[i] = 0
        dotPrimitive[i] = 0
        controlDotPrimitiveStrokeWidth.value = 1

        controlDotBackgroundWhite.checked
        controlDotPrimitiveDot.checked

        controlGridDensity.value = 1
        controlGridStrokeWidth.value = 1
        controlGridX.value = 0
        controlGridY.value = 0
        controlGridAngle.value = 45
        controlGridRotate.value = 0
        gridBackground[i] = 0

        controlGridBackgroundWhite.checked

        geo_setCatPattern(i)
        geo_setParameters(i)
    }

    controlOutline.value = 1
    parameters["outline"] = controlOutline.value

    if(controlHalo){
        controlHalo.value = 1
        parameters["halo"] = parameters["halo"]
    }

    // controlHalo.value = 1
    // parameters["halo"] = controlHalo.value

    let defaultBertinTexturesIndex = Math.floor(Math.random() * bertinTextures.length)
    parameters = {...parameters, ...bertinTextures[defaultBertinTexturesIndex]} //partly update the parameters object, randomly import a texture set from bertinTextures list

    for(let i = 0; i < fruits.length; i++){
        geo_getParameters(i)
        geo_setCatPattern(i)
    }
    controlOutline.value = parameters['outline']
    if(controlHalo){
        controlHalo.value = parameters['halo']
    }

    parametersList = []
    parametersList.push(cloneParameters(parameters))
    localStorage.setItem(chartName+'parametersList', JSON.stringify(parametersList))

    geo_selectCat(0)

    return defaultBertinTexturesIndex
}

//drag and drop to switch textures
function geo_switchTextures(chartName){
    console.log('switch textures')
    for(let i=0; i < fruits.length;i++){
        let dragParameters = {}
        let dropParameters = {}

        d3.selectAll('.category'+i)
            .call(d3.drag()
                .on('start', function(){
                    console.log('drag pattern'+i)
                    geo_selectCat(i)
                    dragParameters['patternType'] = patternType[i]
                    dragParameters['linePatternDensity'] = controlLineDensity.value
                    dragParameters['linePatternStrokeWidth'] = controlLineStrokeWidth.value
                    dragParameters['linePatternStrokeWidthMax'] = controlLineStrokeWidth.max
                    dragParameters['linePatternRotate'] = controlLineRotate.value
                    dragParameters['linePatternBackground'] = lineBackground[i]

                    dragParameters['dotPatternRotate'] = controlDotRotate.value
                    dragParameters['dotPatternDensity'] = controlDotDensity.value
                    dragParameters['dotPatternSize'] = controlDotSize.value
                    dragParameters['dotPatternSizeMax'] = controlDotSize.max
                    dragParameters['dotPatternBackground'] = dotBackground[i]
                    dragParameters['dotPatternPrimitive'] = dotPrimitive[i]
                    dragParameters['dotPatternPrimitiveStrokeWidthMax'] = controlDotPrimitiveStrokeWidth.max
                    dragParameters['dotPatternPrimitiveStrokeWidth'] = controlDotPrimitiveStrokeWidth.value

                    dragParameters['gridPatternDensity'] = controlGridDensity.value
                    dragParameters['gridPatternStrokeWidthMax'] = controlGridStrokeWidth.max
                    dragParameters['gridPatternStrokeWidth'] = controlGridStrokeWidth.value
                    dragParameters['gridPatternAngle'] = controlGridAngle.value
                    dragParameters['gridPatternRotate'] = controlGridRotate.value
                    dragParameters['gridPatternBackground'] = gridBackground[i]

                })
                .on('end', function(event, d){
                    let dropClassName = d3.select(document.elementFromPoint(event.sourceEvent.clientX, event.sourceEvent.clientY))
                        .attr('class')

                    if(dropClassName == null){
                        console.log('please drop the texture to part of the chart')
                    }else{

                        k = dropClassName[dropClassName.length - 1]
                        console.log('drop at' +k )
                        geo_selectCat(k)
                        dropParameters['patternType'] = patternType[k]
                        dropParameters['linePatternDensity'] = controlLineDensity.value
                        dropParameters['linePatternStrokeWidth'] = controlLineStrokeWidth.value
                        dropParameters['linePatternStrokeWidthMax'] = controlLineStrokeWidth.max
                        dropParameters['linePatternRotate'] = controlLineRotate.value
                        dropParameters['linePatternBackground'] = lineBackground[k]

                        dropParameters['dotPatternRotate'] = controlDotRotate.value
                        dropParameters['dotPatternDensity'] = controlDotDensity.value
                        dropParameters['dotPatternSize'] = controlDotSize.value
                        dropParameters['dotPatternSizeMax'] = controlDotSize.max
                        dropParameters['dotPatternBackground'] = dotBackground[k]
                        dropParameters['dotPatternPrimitive'] = dotPrimitive[k]
                        // dropParameters['dotPatternPrimitiveStrokeWidthMax'] = controlDotPrimitiveStrokeWidth.max
                        dropParameters['dotPatternPrimitiveStrokeWidth'] = controlDotPrimitiveStrokeWidth.value

                        dropParameters['gridPatternDensity'] = controlGridDensity.value
                        dropParameters['gridPatternStrokeWidthMax'] = controlGridStrokeWidth.max
                        dropParameters['gridPatternStrokeWidth'] = controlGridStrokeWidth.value
                        dropParameters['gridPatternAngle'] = controlGridAngle.value
                        dropParameters['gridPatternRotate'] = controlGridRotate.value
                        dropParameters['gridPatternBackground'] = gridBackground[k]


                        patternType[k] = dragParameters['patternType']
                        controlLineStrokeWidth.max = dragParameters['linePatternStrokeWidthMax']
                        controlLineDensity.value = dragParameters['linePatternDensity']

                        controlLineStrokeWidth.value = dragParameters['linePatternStrokeWidth']
                        controlLineRotate.value = dragParameters['linePatternRotate']
                        lineBackground[k] = dragParameters['linePatternBackground']

                        controlDotRotate.value = dragParameters['dotPatternRotate']
                        controlDotDensity.value = dragParameters['dotPatternDensity']
                        controlDotSize.max = dragParameters['dotPatternSizeMax']
                        controlDotSize.value = dragParameters['dotPatternSize']

                        dotBackground[k] = dragParameters['dotPatternBackground']
                        dotPrimitive[k] = dragParameters['dotPatternPrimitive']
                        controlDotPrimitiveStrokeWidth.max = dragParameters['dotPatternPrimitiveStrokeWidthMax']
                        controlDotPrimitiveStrokeWidth.value = dragParameters['dotPatternPrimitiveStrokeWidth']

                        controlGridDensity.value = dragParameters['gridPatternDensity']
                        controlGridStrokeWidth.max = dragParameters['gridPatternStrokeWidthMax']
                        controlGridStrokeWidth.value = dragParameters['gridPatternStrokeWidth']
                        controlGridAngle.value = dragParameters['gridPatternAngle']
                        controlGridRotate.value = dragParameters['gridPatternRotate']
                        gridBackground[k] = dragParameters['gridPatternBackground']

                        dragParameters = {}
                        geo_setCatPattern(k)


                        patternType[i] = dropParameters['patternType']
                        controlLineStrokeWidth.max = dropParameters['linePatternStrokeWidthMax']
                        controlLineDensity.value = dropParameters['linePatternDensity']

                        controlLineStrokeWidth.value = dropParameters['linePatternStrokeWidth']
                        controlLineRotate.value = dropParameters['linePatternRotate']
                        lineBackground[i] = dropParameters['linePatternBackground']

                        controlDotRotate.value = dropParameters['dotPatternRotate']
                        controlDotDensity.value = dropParameters['dotPatternDensity']
                        controlDotSize.max = dropParameters['dotPatternSizeMax']
                        controlDotSize.value = dropParameters['dotPatternSize']

                        dotBackground[i] = dropParameters['dotPatternBackground']
                        dotPrimitive[i] = dropParameters['dotPatternPrimitive']
                        controlDotPrimitiveStrokeWidth.max = dropParameters['dotPatternPrimitiveStrokeWidthMax']
                        controlDotPrimitiveStrokeWidth.value = dropParameters['dotPatternPrimitiveStrokeWidth']

                        controlGridDensity.value = dropParameters['gridPatternDensity']
                        controlGridStrokeWidth.max = dropParameters['gridPatternStrokeWidthMax']
                        controlGridStrokeWidth.value = dropParameters['gridPatternStrokeWidth']
                        controlGridAngle.value = dropParameters['gridPatternAngle']
                        controlGridRotate.value = dropParameters['gridPatternRotate']
                        gridBackground[i] = dropParameters['gridPatternBackground']
                        dropParameters = {}

                        geo_setCatPattern(i)
                        addParametersToList(chartName, parameters)

                        geo_selectCat(k)
                    }

                }))
    }
}

function geo_selectDefaultTexture(){
    parameters = {...parameters, ...bertinTextures[selectDefaultTexture.selectedIndex]} //partly update the parameters object

    for(let i = 0; i < fruits.length; i++){
        geo_getParameters(i)
        geo_setCatPattern(i)
    }
    controlOutline.value = parameters['outline']
    if(controlHalo){
        controlHalo.value = parameters['halo']
    }

    parametersList.push(cloneParameters(parameters))
    localStorage.setItem(chartName+'parametersList', JSON.stringify(parametersList))
}

/** iconic texture editing functions */
//choose i-th Cat as the target for all controllers
function icon_selectCat(i){ //i: i-th Cat
    //update the text for fruit indicator
    let fruitName = document.getElementById('fruitName')
    fruitName.innerHTML = fruits[i]

    controlSize.oninput = function () {


        if(document.getElementById("sameSize").checked == true){
            console.log('sameSize')
            for(let k = 0; k < fruits.length; k++){
                // icon_setCatPattern(j, patternSize)
                //get elements of i-th category
                let iconPatterns = document.getElementsByClassName("iconPatternCat"+k); // <pattern> for i-th iconPattern

                //set attributes of <pattern>
                for(let m = 0; m<iconPatterns.length;m++){
                    //<use> elements within <pattern>
                    let iconPatternImgs = iconPatterns[m].getElementsByClassName("iconPattern"+k+"Img")

                    //width and height of <use> - Icon Size of texture
                    for(let j=0;j<iconPatternImgs.length;j++){
                        iconPatternImgs[j].setAttribute('height', controlSize.value)
                        iconPatternImgs[j].setAttribute('width', controlSize.value)
                    }


                }
                parameters["iconPattern"+k+"Size"] = controlSize.value
            }
        }
        if(document.getElementById("sameSize").checked == false){
            icon_setCatPattern(i, patternSize)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlSize.onchange = function(){
        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDensity.oninput = function () {
        //update the Size Controller value and write them into localStorage
        // controlSize.max = patternSize/controlDensity.value * overlap_ratio
        controlSize.max = controlDensity.value * overlap_ratio
        // controlSize.value = 44/controlDensity.value


        if(document.getElementById("sameDensity").checked == true){
            for(let k = 0; k < fruits.length; k++){
                localStorage.setItem(chartName + "_iconPattern"+k+"Size", controlSize.value)
                localStorage.setItem(chartName + "_iconPattern"+k+"SizeMax", controlSize.max)

                //update the output value for Density Controller
                if(document.getElementById("controlDensityOutput")){
                    document.getElementById("controlDensityOutput").value = controlDensity.value
                }

                // let iconPattern = document.getElementById("iconPattern"+k)
                let iconPatterns = document.getElementsByClassName("iconPatternCat"+k)
                for(let m = 0; m < iconPatterns.length; m++){

                    // iconPatterns[m].setAttribute("width", patternSize/controlDensity.value)
                    // iconPatterns[m].setAttribute("height", patternSize/controlDensity.value)
                    iconPatterns[m].setAttribute("width", controlDensity.value)
                    iconPatterns[m].setAttribute("height", controlDensity.value)

                    let iconPatternImgs = iconPatterns[m].getElementsByClassName("iconPattern"+k+"Img")
                    for(let j=0;j<iconPatternImgs.length;j++){
                        if (iconPatternImgs[j].getAttribute('height') > controlDensity.value * overlap_ratio){
                            iconPatternImgs[j].setAttribute('height', controlDensity.value * overlap_ratio)
                            iconPatternImgs[j].setAttribute('width', controlDensity.value * overlap_ratio)
                        }
                    }

                    // iconPatternImgs[1].setAttribute("x", -1 * patternSize/controlDensity.value)
                    // iconPatternImgs[2].setAttribute("x", patternSize/controlDensity.value)
                    // iconPatternImgs[3].setAttribute("y", -1 * patternSize/controlDensity.value)
                    // iconPatternImgs[4].setAttribute("y", patternSize/controlDensity.value)

                    iconPatternImgs[1].setAttribute("x", -1 * controlDensity.value)
                    iconPatternImgs[2].setAttribute("x", controlDensity.value)
                    iconPatternImgs[3].setAttribute("y", -1 * controlDensity.value)
                    iconPatternImgs[4].setAttribute("y", controlDensity.value)
                    iconPatternImgs[5].setAttribute("x", -1 * controlDensity.value)
                    iconPatternImgs[5].setAttribute("y", -1 * controlDensity.value)
                    iconPatternImgs[6].setAttribute("x", controlDensity.value)
                    iconPatternImgs[6].setAttribute("y", -1 * controlDensity.value)
                    iconPatternImgs[7].setAttribute("x", -1 * controlDensity.value)
                    iconPatternImgs[7].setAttribute("y", controlDensity.value)
                    iconPatternImgs[8].setAttribute("x", controlDensity.value)
                    iconPatternImgs[8].setAttribute("y", controlDensity.value)

                }

                // parameters["iconPattern"+k+"Size"] = controlSize.value
                parameters["iconPattern"+k+"SizeMax"] = controlSize.max
                parameters["iconPattern"+k+"Density"] = controlDensity.value
            }
        }

        if(document.getElementById("sameDensity").checked == false){
            // localStorage.setItem(chartName + "_iconPattern"+i+"Size", controlSize.value)
            // localStorage.setItem(chartName + "_iconPattern"+i+"SizeMax", controlSize.max)

            //update the output value for Density Controller
            if(document.getElementById("controlDensityOutput")){
                document.getElementById("controlDensityOutput").value = controlDensity.value
            }


            icon_setCatPattern(i, patternSize)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlDensity.onchange = function(){
        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlX.oninput = function () {
        if(document.getElementById("sameX").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let iconPatterns = document.getElementsByClassName("iconPatternCat"+k)
                for(let m = 0; m < iconPatterns.length; m++){
                    let patternTransform = iconPatterns[m].getAttribute("patternTransform")
                    let str_after = patternTransform.slice(patternTransform.indexOf(',') + 1) //get the string after the specified symbol
                    iconPatterns[m].setAttribute('patternTransform', 'translate('+controlX.value+','+str_after)
                }
                parameters["iconPattern"+k+"X"] = controlX.value
            }
        }

        if(document.getElementById("regionX")){
            if(document.getElementById("regionX").checked == true){
                let iconPattern = document.getElementById('iconPattern'+ localStorage.getItem(chartName+"_selectPattern"))
                let patternTransform = iconPattern.getAttribute("patternTransform")
                let str_after = patternTransform.slice(patternTransform.indexOf(',') + 1) //get the string after the specified symbol
                iconPattern.setAttribute('patternTransform', 'translate('+controlX.value+','+str_after)
            }
            if(document.getElementById("sameX").checked == false && document.getElementById("regionX").checked == false){
                icon_setCatPattern(i, patternSize)
            }
        }else{
            if(document.getElementById("sameX").checked == false){
                icon_setCatPattern(i, patternSize)
            }
        }

        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlX.onchange = function(){
        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    //We can only select one of these two checkbox: #sameX and #regionX
    // if(document.getElementById("regionX")){
    //     document.getElementById("regionX").onclick = function (){
    //         document.getElementById("sameX").checked = false
    //     }
    //     document.getElementById("sameX").onclick = function(){
    //         document.getElementById("regionX").checked = false
    //     }
    // }



    controlY.oninput = function () {
        if(document.getElementById("sameY").checked == true){
            for(let k = 0; k < fruits.length; k++){
                let iconPatterns = document.getElementsByClassName("iconPatternCat"+k)

                for(let m = 0; m < iconPatterns.length; m++){
                    let patternTransform = iconPatterns[m].getAttribute("patternTransform")
                    let str_before = patternTransform.slice(0, patternTransform.indexOf(','))//get the string before the specified symbol
                    let str_after = patternTransform.slice(patternTransform.indexOf(')') + 1)//get the string after the specified symbol
                    iconPatterns[m].setAttribute('patternTransform', str_before+','+controlY.value+')'+str_after)
                }

                parameters["iconPattern"+k+"Y"] = controlY.value
            }
        }

        if(document.getElementById("regionY")){
            if(document.getElementById("regionY").checked == true){
                let iconPattern = document.getElementById('iconPattern'+ localStorage.getItem(chartName+"_selectPattern"))
                let patternTransform = iconPattern.getAttribute("patternTransform")
                let str_before = patternTransform.slice(0, patternTransform.indexOf(','))//get the string before the specified symbol
                let str_after = patternTransform.slice(patternTransform.indexOf(')') + 1)//get the string after the specified symbol
                iconPattern.setAttribute('patternTransform', str_before+','+controlY.value+')'+str_after)
            }
            if(document.getElementById("sameY").checked == false && document.getElementById("regionY").checked == false){
                icon_setCatPattern(i, patternSize)
            }
        }else{
            if(document.getElementById("sameY").checked == false){
                icon_setCatPattern(i, patternSize)
            }
        }

        revisitPostParameters(chartName, parameters, trrack, action)
    }

    //We can only select one of these two checkbox: #sameY and #regionY
    // if(document.getElementById("regionY")){
    //     document.getElementById("regionY").onclick = function (){
    //         document.getElementById("sameY").checked = false
    //     }
    //     document.getElementById("sameY").onclick = function(){
    //         document.getElementById("regionY").checked = false
    //     }
    //
    // }



    controlY.onchange = function(){
        addParametersToList(chartName, parameters)
    }

    controlRotateIcon.oninput = function () {
        if(document.getElementById("sameRotateIcon").checked == true){
            for(let k = 0; k < fruits.length; k++){
                for(let iconStyleIndex = 0; iconStyleIndex < iconStyleList.length; iconStyleIndex ++){ // we should rotate icon of all styles at the same time
                    let fruitIcon = document.getElementById(fruits[k]+'Icon'+ iconStyleIndex) //the icon in the <Symbol> - certain style
                    let transform = fruitIcon.getAttribute('transform') //result: something like: 'rotate(45 25 25) translate(0 0)'
                    let str_after = transform.slice(transform.indexOf(' ') + 1)//get the string after the specified symbol
                    fruitIcon.setAttribute('transform', 'rotate('+ controlRotateIcon.value + ' '+str_after)
                }

                parameters["iconPattern"+k+"RotateIcon"] = controlRotateIcon.value

            }
        }
        if(document.getElementById("sameRotateIcon").checked == false){
            icon_setCatPattern(i, patternSize)
        }

        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlRotateIcon.onchange = function(){
        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlRotate.oninput = function () {
        if(document.getElementById("sameRotate").checked == true){
            sameRotate()
        }
        if(document.getElementById("sameRotate").checked == false){
            icon_setCatPattern(i, patternSize)
        }
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    controlRotate.onchange = function(){
        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }

    // controlAngle0.onclick = function(){
    //     controlRotate.value = 0
    //
    //     if(document.getElementById("sameRotate").checked == true){
    //         sameRotate()
    //     }
    //     if(document.getElemetById("sameRotate").checked == false){
    //         icon_setCatPattern(i, patternSize)
    //     }
    //
    //
    //     addParametersToList(chartName, parameters)
    // }

    controlAngle90.onclick = function(){
        controlRotate.value = 90

        if(document.getElementById("sameRotate").checked == true){
            sameRotate()
        }
        if(document.getElementById("sameRotate").checked == false){
            icon_setCatPattern(i, patternSize)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)

    }


    for(let m = 0; m < iconStyleRadios.length; m++){
        iconStyleRadios[m].onclick = function(){
            iconStyle[i] = m

            if(document.getElementById("sameIconStyle").checked == true){
                for(let k = 0; k < fruits.length; k++){ //k:each category of fruits
                    let iconPatternImgs = document.getElementsByClassName("iconPattern"+k+"Img")
                    let legendImgs = document.getElementsByClassName('legendImg')

                    for(let j=0; j<iconPatternImgs.length; j++){
                        iconPatternImgs[j].setAttribute("href", "#" + iconStyleList[iconStyle[i]] + "_"+ fruits[k])
                        iconPatternImgs[j].setAttribute("xlink:href", "#" + iconStyleList[iconStyle[i]] + "_"+ fruits[k])
                    }

                    iconStyle[k] = m
                    legendImgs[k].setAttribute("href", "#" + iconStyleList[iconStyle[i]] + "_"+ fruits[k]+"_fix")

                    parameters["iconPattern"+k+"IconStyle"] = m
                }

            }
            if(document.getElementById("sameIconStyle").checked == false){
                icon_setCatPattern(i, patternSize)
            }

            addParametersToList(chartName, parameters)
            revisitPostParameters(chartName, parameters, trrack, action)
        }
    }

    controlBackgroundWhite.onclick = function(){
        iconBackground[i] = 0

        if(document.getElementById("sameBackground").checked == true){
            sameBackground(0)
        }
        if(document.getElementById("sameBackground").checked == false){
            icon_setCatPattern(i, patternSize)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)

    }

    controlBackgroundBlack.onclick = function(){
        iconBackground[i] = 1

        if(document.getElementById("sameBackground").checked == true){
            sameBackground(1)
        }
        if(document.getElementById("sameBackground").checked == false){
            icon_setCatPattern(i, patternSize)
        }

        addParametersToList(chartName, parameters)
        revisitPostParameters(chartName, parameters, trrack, action)
    }




    //set radio button: the checked icon style is corresponding to current icon style of the Cat
    iconStyleRadios[iconStyle[i]].checked = true;

    icon_getParameters(i)
    //set controller value according to current pattern of the i-th category
    // iconBackground[i] = localStorage.getItem(chartName + "_iconPattern"+i+"Background", iconBackground[i])
    controlBackgroundRadios[iconBackground[i]].checked = true

    //set legend image as the icon of the selected fruit
    detailImg.setAttribute("href", "#" + "detail_"+ fruits[i] +"_fix")
    strokeImg.setAttribute("href", "#" + "stroke_"+ fruits[i] +"_fix")
    simpleStrokeImg.setAttribute("href", "#" + "simple_stroke_"+ fruits[i] +"_fix")
    simpleFillImg.setAttribute("href", "#" + "simple_fill_"+ fruits[i] +"_fix")

    //set color of indicator and legend
    for(let j = 0; j < fruits.length; j++){
        if(j == i){
            if(!chartName.startsWith("map")){
                indicators[j].setAttribute("fill", "#1E90FF") // show indicator for the selected bar
            }

            legendIndicators[j].setAttribute("fill", "#1E90FF")
            legendLabels[j].setAttribute("fill", "#1E90FF")
        }
        else{
            if(!chartName.startsWith("map")){
                indicators[j].setAttribute("fill", "none") // show indicator for the selected bar
            }
            legendIndicators[j].setAttribute("fill", "none")
            legendLabels[j].setAttribute("fill", "#000000")
        }
    }
}

function icon_setInitialParameters(chartName){

    if(localStorage.getItem(chartName+"parametersList") == null || JSON.parse(localStorage.getItem(chartName+"parametersList")).length === 0){
        icon_defaultParameters(chartName)
    }else{
        parametersList = JSON.parse(localStorage.getItem(chartName+"parametersList") || "[]")

        parameters = parametersList[parametersList.length - 1]
        for(let i = 0; i < fruits.length; i++){
            icon_getParameters(i)
            icon_setCatPattern(i, patternSize)
        }
        controlOutline.value = parameters["outline"]
        if(controlHalo){
            controlHalo.value = parameters["halo"]
        }
        drawOutline('chart_outline', parameters["outline"], 'chart_halo', parameters["halo"])
    }

    //set selectedCat
    if(localStorage.getItem(chartName + "_selectedCat") == null){
        icon_selectCat(0)
    }else{
        icon_selectCat(Number(localStorage.getItem(chartName + "_selectedCat")))
    }
    getSameCheckboxesStatus(chartName)
    revisitPostParameters(chartName, parameters, trrack, action)
}

function icon_setParameters(i){ //write the value of texture parameter controllers to the Object parameters
    parameters["iconPattern"+i+"IconStyle"] = iconStyle[i]
    parameters["iconPattern"+i+"Density"] = controlDensity.value
    parameters["iconPattern"+i+"SizeMax"] = controlSize.max
    parameters["iconPattern"+i+"Size"] = controlSize.value
    parameters["iconPattern"+i+"X"] = controlX.value
    parameters["iconPattern"+i+"Y"] = controlY.value
    parameters["iconPattern"+i+"RotateIcon"] = controlRotateIcon.value
    parameters["iconPattern"+i+"Rotate"] = controlRotate.value
    parameters["iconPattern"+i+"Background"] = iconBackground[i]

}

function icon_getParameters(i){ //write the value in Object parameters to texture parameter controllers
    iconStyle[i] = parameters["iconPattern"+i+"IconStyle"]
    controlDensity.value = parameters["iconPattern"+i+"Density"]
    controlSize.max = parameters["iconPattern"+i+"SizeMax"]
    controlSize.value = parameters["iconPattern"+i+"Size"]
    controlX.value = parameters["iconPattern"+i+"X"]
    controlY.value = parameters["iconPattern"+i+"Y"]
    controlRotateIcon.value = parameters["iconPattern"+i+"RotateIcon"]
    controlRotate.value = parameters["iconPattern"+i+"Rotate"]
    iconBackground[i] = parameters["iconPattern"+i+"Background"]
    // controlOutline.value = parameters["outline"]
}

function icon_defaultParameters(chartName){
    parameters = {}
    for(let i = 0; i < fruits.length; i++){

        //we do not need iconStyle[i] = 0, because in the function icon_setCatPattern, we will set iconStyle[i] based on iconStyleRadios
        iconStyleRadios[0].checked = true
        // iconStyle[i] = 0


        controlDensity.value = 45
        // controlSize.max = patternSize/controlDensity.value * overlap_ratio
        // controlSize.value = patternSize/controlDensity.value
        controlSize.max = controlDensity.value * overlap_ratio
        controlSize.value = controlDensity.value
        // controlSize.max = xScale.bandwidth()/controlDensity.value
        // controlSize.value = xScale.bandwidth()/controlDensity.value
        controlX.value = 0
        controlY.value = 0
        controlRotateIcon.value = 45
        controlRotate.value = 315

        iconBackground[i] = 0
        controlBackgroundWhite.checked
        // localStorage.setItem(chartName + "_iconPattern"+i+"Background", iconBackground[i])

        icon_setCatPattern(i, patternSize)
        // icon_setParameters(i)
    }

    controlOutline.value = 1
    parameters["outline"] = controlOutline.value
    if(controlHalo){
        controlHalo.value = 1
        parameters["halo"] = controlHalo.value
        drawOutline('chart_outline', controlOutline.value, 'chart_halo', controlHalo.value)
    }
    drawOutline('chart_outline', controlOutline.value)



    addParametersToList(chartName, parameters)
    revisitPostParameters(chartName, parameters, trrack, action)

    // parametersList = []
    // parametersList.push(cloneParameters(parameters))
    // localStorage.setItem(chartName+'parametersList', JSON.stringify(parametersList))

    // icon_selectCat(0)
}

function iconTextures(e, data){

    let defs = e.append("defs")

    defs.selectAll("symbol_stroke") //stroke style <symbol> for iconic textures
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => `stroke_${fruits[i]}`)
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon0`) // e.g. carrotIcon0, 0 refers to stroke.
        .attr('transform', 'rotate(45 25 25) translate(0 0)') //rotate 45 degree as default to balance the rotation of pattern
        .append("path")
        .attr("d", (_, i) => strokePathsList[i])

    defs.selectAll("symbol_stroke_fix") //stroke style <symbol> that will not be rotated, can be used for legend, icon style radio
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => `stroke_${fruits[i]}_fix`)
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon0_fix`) // e.g. carrotIcon0, 0 refers to stroke.
        .attr('transform', 'rotate(0 25 25) translate(0 0)')
        .append("path")
        .attr("d", (_, i) => strokePathsList[i])


    defs.selectAll("detail_stroke") //detail style <symbol> for iconic textures
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => `detail_${fruits[i]}`)
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon1`) // e.g. carrotIcon1, 1 refers to detail.
        .attr('transform', 'rotate(45 25 25) translate(0 0)') //rotate 45 degree as default to balance the rotation of pattern
        .append("path")
        .attr("d", (_, i) => detailPathsList[i])

    defs.selectAll("detail_stroke_fix") //detail style <symbol> that will not be rotated, can be used for legend, icon style radio
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => `detail_${fruits[i]}_fix`)
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon1_fix`) // e.g. carrotIcon1, 1 refers to detail.
        .attr('transform', 'rotate(0 25 25) translate(0 0)')
        .append("path")
        .attr("d", (_, i) => detailPathsList[i])


    defs.selectAll("simple_stroke") //simple_stroke style <symbol> for iconic textures
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => `simple_stroke_${fruits[i]}`)
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon2`) // e.g. carrotIcon2, 2 refers to simple_stroke.
        .attr('transform', 'rotate(45 25 25) translate(0 0)') //rotate 45 degree as default to balance the rotation of pattern
        .append("path")
        .attr("d", (_, i) => simple_stroke_paths_list[i])

    defs.selectAll("simple_stroke_fix") //simple_stroke style <symbol> that will not be rotated, can be used for legend, icon style radio
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => `simple_stroke_${fruits[i]}_fix`)
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon2_fix`) // e.g. carrotIcon1, 1 refers to detail.
        .attr('transform', 'rotate(0 25 25) translate(0 0)')
        .append("path")
        .attr("d", (_, i) => simple_stroke_paths_list[i])


    defs.selectAll("simple_fill") //simple_fill style <symbol> for iconic textures
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => `simple_fill_${fruits[i]}`)
        .attr("viewBox", "45 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon3`) // e.g. carrotIcon3, 3 refers to simple_stroke.
        .attr('transform', 'rotate(45 25 25) translate(0 0)') //rotate 45 degree as default to balance the rotation of pattern
        .append("path")
        .attr("d", (_, i) => simple_fill_paths_list[i])

    defs.selectAll("simple_fill_fix") //simple_fill style <symbol> that will not be rotated, can be used for legend, icon style radio
        .data(data)
        .enter()
        .append("symbol")
        .attr("id", (_, i) => `simple_fill_${fruits[i]}_fix`)
        .attr("viewBox", "0 0 50 50")
        .attr("overflow", "visible")
        .append("g")
        .attr("id", (_, i) => `${fruits[i]}Icon3_fix`) // e.g. carrotIcon3, 3 refers to simple_stroke.
        .attr('transform', 'rotate(0 25 25) translate(0 0)')
        .append("path")
        .attr("d", (_, i) => simple_fill_paths_list[i])


    let pattern = defs.selectAll("pattern")
        .data(data)
        .enter()
        .append("pattern")
        .attr("class", (_, i) => `iconPatternCat${i}`)
        .attr("id", (_, i) => `iconPattern${i}`)
        .attr("patternUnits", "userSpaceOnUse")
    // .attr("width", 40)
    // .attr("height", 40)

    pattern.append("rect")
        .attr("class", (_, i) => "iconPattern"+i+"Background")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 400)
        .attr("height", 400)
        .attr("stroke-width", 0)
        .attr("fill", "white")


    //To make the icons overflows from the <pattern>, we need multiple <use>
    //reference: https://stackoverflow.com/questions/74368854/make-svg-pattern-content-overflow-from-the-frame-of-pattern-rather-than-being/75321759#75321759
    pattern.append("use") //1st <use>
        .attr("class", (_, i) =>"iconPattern"+i+"Img")

    pattern.append("use") //2nd <use>
        .attr("class", (_, i) =>"iconPattern"+i+"Img")

    pattern.append("use") //3rd <use>
        .attr("class", (_, i) =>"iconPattern"+i+"Img")

    pattern.append("use") //4th <use>
        .attr("class", (_, i) =>"iconPattern"+i+"Img")

    pattern.append("use") //5th <use>
        .attr("class", (_, i) =>"iconPattern"+i+"Img")

    pattern.append("use") //6th <use>
        .attr("class", (_, i) =>"iconPattern"+i+"Img")

    pattern.append("use") //7th <use>
        .attr("class", (_, i) =>"iconPattern"+i+"Img")

    pattern.append("use") //8th <use>
        .attr("class", (_, i) =>"iconPattern"+i+"Img")

    pattern.append("use") //9th <use>
        .attr("class", (_, i) =>"iconPattern"+i+"Img")


    return defs
}

//set radios to control step of rotate icon controller
function icon_setRotateIconTicks(){
    if(document.getElementById("rotateIconMajorticksRadio")){
        document.getElementById("rotateIconMajorticksRadio").onclick = function(){
            controlRotateIcon.step = 90
        }
        document.getElementById("rotateIconMinorticksRadio").onclick = function(){
            controlRotateIcon.step = 45
        }
        document.getElementById("rotateIconNorestrictionRadio").onclick = function(){
            controlRotateIcon.step = 0.1
        }
    }
}

function icon_setDensityTicks(){
    if(document.getElementById("densityMajorticksRadio")){
        document.getElementById("densityMajorticksRadio").onclick = function(){
            controlDensity.step = 1
        }
        document.getElementById("densityMinorticksRadio").onclick = function(){
            controlDensity.step = 0.5
        }
        document.getElementById("densityNorestrictionRadio").onclick = function(){
            controlDensity.step = 0.1
        }
    }
}

function icon_setCatPattern(i, patternSize){ //i: the i-th category
    // console.log('origin: iconStyle'+i+'='+ iconStyle[i])
    //get elements of i-th category
    let iconPatterns = document.getElementsByClassName("iconPatternCat"+i); // <pattern> for i-th iconPattern

    //set attributes of <pattern>
    for(let k = 0; k<iconPatterns.length;k++){
        //width and height of <pattern> - Density of texture
        // iconPatterns[k].setAttribute("width", patternSize/controlDensity.value)
        // iconPatterns[k].setAttribute("height", patternSize/controlDensity.value)
        iconPatterns[k].setAttribute("width", controlDensity.value)
        iconPatterns[k].setAttribute("height", controlDensity.value)

        //position of <pattern> - X, Y, Rotation of texture
        iconPatterns[k].setAttribute("patternTransform", "translate(" + controlX.value+","+controlY.value+") rotate("+controlRotate.value+")")


        //<use> elements within <pattern>
        let iconPatternImgs = iconPatterns[k].getElementsByClassName("iconPattern"+i+"Img")

        //<rect> element for background color within <pattern>
        let iconPatternBackgrounds = document.getElementsByClassName("iconPattern" + i +"Background")

        //width and height of <use> - Icon Size of texture
        for(let j=0;j<iconPatternImgs.length;j++){
            iconPatternImgs[j].setAttribute('height', controlSize.value)
            iconPatternImgs[j].setAttribute('width', controlSize.value)
        }

        //to enable overlap of icons, we need 5 <use> and control their position, to merge to 1 icon. Their x and y are the width and height of pattern.
        //reference: https://stackoverflow.com/questions/74368854/make-svg-pattern-content-overflow-from-the-frame-of-pattern-rather-than-being
        // iconPatternImgs[1].setAttribute("x", -1 * patternSize/controlDensity.value)
        // iconPatternImgs[2].setAttribute("x", patternSize/controlDensity.value)
        // iconPatternImgs[3].setAttribute("y", -1 * patternSize/controlDensity.value)
        // iconPatternImgs[4].setAttribute("y", patternSize/controlDensity.value)
        // iconPatternImgs[5].setAttribute("x", -1 * patternSize/controlDensity.value)
        // iconPatternImgs[5].setAttribute("y", -1 * patternSize/controlDensity.value)
        // iconPatternImgs[6].setAttribute("x", patternSize/controlDensity.value)
        // iconPatternImgs[6].setAttribute("y", -1 * patternSize/controlDensity.value)
        // iconPatternImgs[7].setAttribute("x", -1 * patternSize/controlDensity.value)
        // iconPatternImgs[7].setAttribute("y", patternSize/controlDensity.value)
        // iconPatternImgs[8].setAttribute("x", patternSize/controlDensity.value)
        // iconPatternImgs[8].setAttribute("y", patternSize/controlDensity.value)

        iconPatternImgs[1].setAttribute("x", -1 * controlDensity.value)
        iconPatternImgs[2].setAttribute("x", controlDensity.value)
        iconPatternImgs[3].setAttribute("y", -1 * controlDensity.value)
        iconPatternImgs[4].setAttribute("y", controlDensity.value)
        iconPatternImgs[5].setAttribute("x", -1 * controlDensity.value)
        iconPatternImgs[5].setAttribute("y", -1 * controlDensity.value)
        iconPatternImgs[6].setAttribute("x", controlDensity.value)
        iconPatternImgs[6].setAttribute("y", -1 * controlDensity.value)
        iconPatternImgs[7].setAttribute("x", -1 * controlDensity.value)
        iconPatternImgs[7].setAttribute("y", controlDensity.value)
        iconPatternImgs[8].setAttribute("x", controlDensity.value)
        iconPatternImgs[8].setAttribute("y", controlDensity.value)

        controlBackgroundRadios[iconBackground[i]].checked = true


        //set background
        if(controlBackgroundBlack.checked){
            // iconPatternBackground.setAttribute("fill", "black")
            for(let j = 0; j < iconPatternBackgrounds.length; j++){ //class: both Background of legend and chart
                iconPatternBackgrounds[j].setAttribute("fill", "black")
            }

            iconBackground[i] = 1

        }else if(controlBackgroundWhite.checked){
            // iconPatternBackground.setAttribute("fill", "white")
            for(let j = 0; j < iconPatternBackgrounds.length; j++){
                iconPatternBackgrounds[j].setAttribute("fill", "white")
            }
            iconBackground[i] = 0
        }


        //set icon style
        for(let k = 0; k < iconStyleRadios.length; k++){
            if(iconStyleRadios[k].checked){

                iconStyle[i] = k
                console.log('set: iconStyle'+i+'='+k)
            }
        }

        for(let j=0; j<iconPatternImgs.length; j++){
            // iconPatternImgs[j].setAttribute("href", "../img/fruit/" + iconBackground[i]+ "-"+iconStyleList[iconStyle[i]] + "-"+ fruits[i]+".svg")
            iconPatternImgs[j].setAttribute("href", "#" + iconStyleList[iconStyle[i]] + "_"+ fruits[i])
            iconPatternImgs[j].setAttribute("xlink:href", "#" + iconStyleList[iconStyle[i]] + "_"+ fruits[i])
            if(iconBackground[i]==0){
                iconPatternImgs[j].setAttribute('fill', '#000000')
            }
            if(iconBackground[i]==1) {
                iconPatternImgs[j].setAttribute('fill', '#ffffff')
            }
        }
        let fruitIcon = document.getElementById(fruits[i]+'Icon'+iconStyle[i])
        // fruitIcon.setAttribute('transform', 'rotate('+controlRotateIcon.value+' '+controlSize.value/2 + ' '+ controlSize.value/2 +') translate(0 0)')
        fruitIcon.setAttribute('transform', 'rotate('+controlRotateIcon.value+' 25 25) translate(0 0)')

        legendImgs[i].setAttribute("href", "#" + iconStyleList[iconStyle[i]] + "_"+ fruits[i] +"_fix")
        if(iconBackground[i]==0){
            legendImgs[i].setAttribute('fill', '#000000')
        }
        if(iconBackground[i]==1) {
            legendImgs[i].setAttribute('fill', '#ffffff')
        }

    }
    icon_setParameters(i)
}

function icon_switchTextures(chartName){
    for(let i=0; i < fruits.length;i++){
        let dragParameters = {}
        let dropParameters = {}

        d3.selectAll('.category'+i)
            .call(d3.drag()
                .on('start', function(){
                    console.log('drag pattern' +i)
                    icon_selectCat(i)
                    dragParameters['iconPatternIconStyle'] = iconStyle[i]
                    dragParameters['iconPatternDensity'] = controlDensity.value
                    dragParameters['iconPatternSizeMax'] = controlSize.max
                    dragParameters['iconPatternSize'] = controlSize.value
                    dragParameters['iconPatternX'] = controlX.value
                    dragParameters['iconPatternY'] = controlY.value
                    dragParameters['iconPatternRotateIcon'] = controlRotateIcon.value
                    dragParameters['iconPatternRotate'] = controlRotate.value
                    dragParameters['iconPatternBackground'] = iconBackground[i]
                })
                .on('end', function(event,d){
                    let dropClassName = d3.select(document.elementFromPoint(event.sourceEvent.clientX, event.sourceEvent.clientY))
                        .attr('class')
                    if(dropClassName == null){
                        console.log('please drop the texture to another texture on the chart')
                    }else{

                        k = dropClassName[dropClassName.length - 1]

                        console.log('drop to pattern' +k)

                        icon_selectCat(k)
                        dropParameters['iconPatternIconStyle'] = iconStyle[k]
                        dropParameters['iconPatternSizeMax'] = controlSize.max
                        dropParameters['iconPatternDensity'] = controlDensity.value
                        dropParameters['iconPatternSize'] = controlSize.value
                        dropParameters['iconPatternX'] = controlX.value
                        dropParameters['iconPatternY'] = controlY.value
                        dropParameters['iconPatternRotateIcon'] = controlRotateIcon.value
                        dropParameters['iconPatternRotate'] = controlRotate.value
                        dropParameters['iconPatternBackground'] = iconBackground[k]

                        iconStyle[k] = dragParameters['iconPatternIconStyle']
                        iconStyleRadios[iconStyle[k]].checked = true

                        controlDensity.value = dragParameters['iconPatternDensity']
                        controlSize.max = dragParameters['iconPatternSizeMax']
                        controlSize.value = dragParameters['iconPatternSize']
                        controlX.value = dragParameters['iconPatternX']
                        controlY.value = dragParameters['iconPatternY']
                        controlRotateIcon.value = dragParameters['iconPatternRotateIcon']
                        controlRotate.value = dragParameters['iconPatternRotate']
                        iconBackground[k] = dragParameters['iconPatternBackground']


                        dragParameters = {}

                        icon_setCatPattern(k, patternSize)

                        icon_selectCat(k)

                        iconStyle[i] = dropParameters['iconPatternIconStyle']
                        iconStyleRadios[iconStyle[i]].checked = true
                        controlDensity.value = dropParameters['iconPatternDensity']
                        controlSize.max = dropParameters['iconPatternSizeMax']
                        controlSize.value = dropParameters['iconPatternSize']
                        controlX.value = dropParameters['iconPatternX']
                        controlY.value = dropParameters['iconPatternY']
                        controlRotateIcon.value = dropParameters['iconPatternRotateIcon']
                        controlRotate.value = dropParameters['iconPatternRotate']
                        iconBackground[i] = dropParameters['iconPatternBackground']

                        dropParameters = {}
                        icon_setCatPattern(i, patternSize)
                        addParametersToList(chartName, parameters)
                    }

                }))
    }
}

function sameRotate(){ //iconic texture, when set sameRotate = true
    for(let k = 0; k < fruits.length; k++){
        let iconPatterns = document.getElementsByClassName("iconPatternCat"+k)

        for(let m = 0; m < iconPatterns.length; m++){
            let patternTransform = iconPatterns[m].getAttribute("patternTransform")
            let s1 = patternTransform.split('(')[0] //the string before the 1st "("
            let s2 = patternTransform.split('(')[1] //the string between the 1st "(" and the 2nd "("
            iconPatterns[m].setAttribute('patternTransform', s1 + '(' + s2 + '(' +controlRotate.value+')')
        }

        parameters["iconPattern"+k+"Rotate"] = controlRotate.value
    }
}

function sameBackground(backgroundType){  //for iconic texture, when set sameBackground = true. white background: backgroundType = 0; black background: backgroundType = 1
    for(let k = 0; k < fruits.length; k++){
        let iconColor //color of icons
        let backgroudColor //color of background

        if(backgroundType == 0){
            iconColor = '#000000' //black
            backgroudColor = '#ffffff' //white
        }else if(backgroundType == 1){
            iconColor = '#ffffff' //white
            backgroudColor = '#000000' //black
        }

        //change the fill color of icons
        let iconPatternImgs = document.getElementsByClassName("iconPattern"+k+"Img")
        for(let j=0; j<iconPatternImgs.length; j++){
            iconPatternImgs[j].setAttribute('fill', iconColor)
        }

        //change the fill color of background of texture and legends
        let iconPatternBackgrounds = document.getElementsByClassName("iconPattern" + k +"Background")
        for(let j=0; j<iconPatternBackgrounds.length; j++) {
            iconPatternBackgrounds[j].setAttribute("fill", backgroudColor)
        }

        //change the fill color of icons of legends
        let legendImgs = document.getElementsByClassName("legendImg")
        legendImgs[k].setAttribute('fill', iconColor)

        parameters["iconPattern"+k+"Background"] = backgroundType
    }
}


/** other */
function cloneParameters(parameters) { //parametersList.push(parameters) will cause overwriting. Use this function to avoid overwriting.
    var clone ={};
    for( var key in parameters ){
        if(parameters.hasOwnProperty(key)) //ensure not adding inherited props
            clone[key]=parameters[key]
    }
    return clone
}

/**
 * post parameters to Revisit
 * @param chartName
 * @param parameters
 * @param trrack
 * @param actions
 */
function revisitPostParameters(chartName, parameters, trrack, actions){
    if(chartName === 'barGeo'){
        trrack.apply("BarGeoParameters", actions.updateBarGeoParameters(cloneParameters(parameters)))
        console.log('barGeoParameters applied')
    }else if(chartName === 'barIcon'){
        trrack.apply("BarIconParameters", actions.updateBarIconParameters(cloneParameters(parameters)))
        console.log('barIconParameters applied')
    }else if(chartName === 'pieGeo'){
        trrack.apply("PieGeoParameters", actions.updatePieGeoParameters(cloneParameters(parameters)))
        console.log('pieGeoParameters applied')
    }else if(chartName === 'pieIcon'){
        trrack.apply("PieIconParameters", actions.updatePieIconParameters(cloneParameters(parameters)))
        console.log('pieIconParameters applied')
    }else if(chartName === 'mapGeo'){
        trrack.apply("MapGeoParameters", actions.updateMapGeoParameters(cloneParameters(parameters)))
        console.log('mapGeoParameters applied')
    }else if(chartName === 'mapIcon'){
        trrack.apply("MapIconParameters", actions.updateMapIconParameters(cloneParameters(parameters)))
        console.log('mapIconParameters applied')
    }
    // console.log(trrack.graph.backend)
    Revisit.postProvenance(trrack.graph.backend)
    console.log(trrack.graph.backend)

    Revisit.postAnswers(
        {
            answer: {
                parameters: cloneParameters(parameters),
                chartName: chartName,
            }
        }
    )
    console.log("postAnswers")
    // console.log(parameters)
        
}

/**
 * add parameters to parametersList, and updata the parametersList in the localStorage.
 * use it every time when we change parameters -- any action we do to textures will change its parameters
 * @param chartName
 * @param parameters the new parameters we want to add to parametersList
 */
function addParametersToList(chartName, parameters){
    //get the original parametersList from localStorage
    let parametersList = JSON.parse(localStorage.getItem(chartName+'parametersList') || '[]')

    //add the new parameters into parametersList
    parametersList.push(cloneParameters(parameters))

    //update the parametersList in the localStorage
    localStorage.setItem(chartName+'parametersList', JSON.stringify(parametersList))

    //move the pointer to the end of paramtersList. This pointer is used for undo and redo function.
    let pointer = parametersList.length - 1
    localStorage.setItem(chartName+'pointer', pointer)

}

function saveParameters(chartName){
    $.ajax({
        url: './ajax/'+chartName+'_results.php', //path to the script who handles this
        type: 'POST',
        data: localStorage.getItem(chartName+'parametersList'),
        dataType: 'JSON',
        contentType: 'application/json',
        success: function () {
            // console.log(this.data);
            console.log('parameters saved to server')
        }
    })

    alert('texture parameters saved to server');
}

/**
 * set select category. This function can be used for both geometric chart and iconic chart.
 * @param chartName
 */
function setSelectCat(chartName){
    //select a category
    for(let i=0; i < fruits.length;i++){
        d3.selectAll('.category'+i)
            .on('click', function(){// let controllers control the selected bar
                console.log('selected pattern'+i)
                if(chartName.endsWith('Geo')){
                    geo_selectCat(i)
                }
                if(chartName.endsWith('Icon')){
                    icon_selectCat(i)
                }

                localStorage.setItem(chartName + '_selectedCat', i)
            })
    }
}

//generate random dataset with 7(fruits.length) fruits
function generateRandomFruitsDataset(fruits){
    let data = []
    for (let i = 0; i < fruits.length; i++){
        let fruitObject = {}
        fruitObject.fruit = fruits[i]
        fruitObject.value = Math.floor(Math.random() * 100) + 1 // Returns a random integer from 1 to 100:
        data.push(fruitObject)
    }
    return data
}

function generateRandomMapDataset(){
    let data = []

    //read population_data from pages/data/population.csv to get CODE_DEP
    let population_data = [
        {
            "CODE_REG": 82,
            "NOM_REGION": "Rhône-Alpes",
            "CODE_DEPT": "01",
            "NOM_DEPT": "Ain",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 43,
            "NB_COMMUNES": 419,
            "POP": 614331
        },
        {
            "CODE_REG": 22,
            "NOM_REGION": "Picardie",
            "CODE_DEPT": "02",
            "NOM_DEPT": "Aisne",
            "NB_ARRONDS": 5,
            "NB_CANTONS": 42,
            "NB_COMMUNES": 816,
            "POP": 555094
        },
        {
            "CODE_REG": 83,
            "NOM_REGION": "Auvergne",
            "CODE_DEPT": "03",
            "NOM_DEPT": "Allier",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 35,
            "NB_COMMUNES": 320,
            "POP": 353124
        },
        {
            "CODE_REG": 93,
            "NOM_REGION": "Provence-Alpes-Côte d'Azur",
            "CODE_DEPT": "04",
            "NOM_DEPT": "Alpes-de-Haute-Provence",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 30,
            "NB_COMMUNES": 200,
            "POP": 165155
        },
        {
            "CODE_REG": 93,
            "NOM_REGION": "Provence-Alpes-Côte d'Azur",
            "CODE_DEPT": "05",
            "NOM_DEPT": "Hautes-Alpes",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 30,
            "NB_COMMUNES": 177,
            "POP": 142312
        },
        {
            "CODE_REG": 93,
            "NOM_REGION": "Provence-Alpes-Côte d'Azur",
            "CODE_DEPT": "06",
            "NOM_DEPT": "Alpes-Maritimes",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 52,
            "NB_COMMUNES": 163,
            "POP": 1094579
        },
        {
            "CODE_REG": 82,
            "NOM_REGION": "Rhône-Alpes",
            "CODE_DEPT": "07",
            "NOM_DEPT": "Ardèche",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 33,
            "NB_COMMUNES": 339,
            "POP": 324885
        },
        {
            "CODE_REG": 21,
            "NOM_REGION": "Champagne-Ardenne",
            "CODE_DEPT": "08",
            "NOM_DEPT": "Ardennes",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 37,
            "NB_COMMUNES": 463,
            "POP": 291678
        },
        {
            "CODE_REG": 73,
            "NOM_REGION": "Midi-Pyrénées",
            "CODE_DEPT": "09",
            "NOM_DEPT": "Ariège",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 22,
            "NB_COMMUNES": 332,
            "POP": 157582
        },
        {
            "CODE_REG": 21,
            "NOM_REGION": "Champagne-Ardenne",
            "CODE_DEPT": 10,
            "NOM_DEPT": "Aube",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 33,
            "NB_COMMUNES": 433,
            "POP": 311720
        },
        {
            "CODE_REG": 91,
            "NOM_REGION": "Languedoc-Roussillon",
            "CODE_DEPT": 11,
            "NOM_DEPT": "Aude",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 35,
            "NB_COMMUNES": 438,
            "POP": 365854
        },
        {
            "CODE_REG": 73,
            "NOM_REGION": "Midi-Pyrénées",
            "CODE_DEPT": 12,
            "NOM_DEPT": "Aveyron",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 46,
            "NB_COMMUNES": 304,
            "POP": 288364
        },
        {
            "CODE_REG": 93,
            "NOM_REGION": "Provence-Alpes-Côte d'Azur",
            "CODE_DEPT": 13,
            "NOM_DEPT": "Bouches-du-Rhône",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 57,
            "NB_COMMUNES": 119,
            "POP": 2000550
        },
        {
            "CODE_REG": 25,
            "NOM_REGION": "Basse-Normandie",
            "CODE_DEPT": 14,
            "NOM_DEPT": "Calvados",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 49,
            "NB_COMMUNES": 706,
            "POP": 699561
        },
        {
            "CODE_REG": 83,
            "NOM_REGION": "Auvergne",
            "CODE_DEPT": 15,
            "NOM_DEPT": "Cantal",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 27,
            "NB_COMMUNES": 260,
            "POP": 154135
        },
        {
            "CODE_REG": 54,
            "NOM_REGION": "Poitou-Charentes",
            "CODE_DEPT": 16,
            "NOM_DEPT": "Charente",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 35,
            "NB_COMMUNES": 404,
            "POP": 364429
        },
        {
            "CODE_REG": 54,
            "NOM_REGION": "Poitou-Charentes",
            "CODE_DEPT": 17,
            "NOM_DEPT": "Charente-Maritime",
            "NB_ARRONDS": 5,
            "NB_CANTONS": 51,
            "NB_COMMUNES": 472,
            "POP": 640803
        },
        {
            "CODE_REG": 24,
            "NOM_REGION": "Centre",
            "CODE_DEPT": 18,
            "NOM_DEPT": "Cher",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 35,
            "NB_COMMUNES": 290,
            "POP": 319600
        },
        {
            "CODE_REG": 74,
            "NOM_REGION": "Limousin",
            "CODE_DEPT": 19,
            "NOM_DEPT": "Corrèze",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 37,
            "NB_COMMUNES": 286,
            "POP": 252235
        },
        {
            "CODE_REG": 94,
            "NOM_REGION": "Corse",
            "CODE_DEPT": "2A",
            "NOM_DEPT": "Corse-du-Sud",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 22,
            "NB_COMMUNES": 124,
            "POP": 145998
        },
        {
            "CODE_REG": 94,
            "NOM_REGION": "Corse",
            "CODE_DEPT": "2B",
            "NOM_DEPT": "Haute-Corse",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 30,
            "NB_COMMUNES": 236,
            "POP": 168869
        },
        {
            "CODE_REG": 26,
            "NOM_REGION": "Bourgogne",
            "CODE_DEPT": 21,
            "NOM_DEPT": "Côte-d'Or",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 43,
            "NB_COMMUNES": 706,
            "POP": 538505
        },
        {
            "CODE_REG": 53,
            "NOM_REGION": "Bretagne",
            "CODE_DEPT": 22,
            "NOM_DEPT": "Côtes-d'Armor",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 52,
            "NB_COMMUNES": 373,
            "POP": 612383
        },
        {
            "CODE_REG": 74,
            "NOM_REGION": "Limousin",
            "CODE_DEPT": 23,
            "NOM_DEPT": "Creuse",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 27,
            "NB_COMMUNES": 260,
            "POP": 127919
        },
        {
            "CODE_REG": 72,
            "NOM_REGION": "Aquitaine",
            "CODE_DEPT": 24,
            "NOM_DEPT": "Dordogne",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 50,
            "NB_COMMUNES": 557,
            "POP": 426607
        },
        {
            "CODE_REG": 43,
            "NOM_REGION": "Franche-Comté",
            "CODE_DEPT": 25,
            "NOM_DEPT": "Doubs",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 35,
            "NB_COMMUNES": 594,
            "POP": 542509
        },
        {
            "CODE_REG": 82,
            "NOM_REGION": "Rhône-Alpes",
            "CODE_DEPT": 26,
            "NOM_DEPT": "Drôme",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 36,
            "NB_COMMUNES": 369,
            "POP": 499313
        },
        {
            "CODE_REG": 23,
            "NOM_REGION": "Haute-Normandie",
            "CODE_DEPT": 27,
            "NOM_DEPT": "Eure",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 43,
            "NB_COMMUNES": 675,
            "POP": 603194
        },
        {
            "CODE_REG": 24,
            "NOM_REGION": "Centre",
            "CODE_DEPT": 28,
            "NOM_DEPT": "Eure-et-Loir",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 29,
            "NB_COMMUNES": 402,
            "POP": 440291
        },
        {
            "CODE_REG": 53,
            "NOM_REGION": "Bretagne",
            "CODE_DEPT": 29,
            "NOM_DEPT": "Finistère",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 54,
            "NB_COMMUNES": 283,
            "POP": 929286
        },
        {
            "CODE_REG": 91,
            "NOM_REGION": "Languedoc-Roussillon",
            "CODE_DEPT": 30,
            "NOM_DEPT": "Gard",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 46,
            "NB_COMMUNES": 353,
            "POP": 726285
        },
        {
            "CODE_REG": 73,
            "NOM_REGION": "Midi-Pyrénées",
            "CODE_DEPT": 31,
            "NOM_DEPT": "Haute-Garonne",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 53,
            "NB_COMMUNES": 589,
            "POP": 1268370
        },
        {
            "CODE_REG": 73,
            "NOM_REGION": "Midi-Pyrénées",
            "CODE_DEPT": 32,
            "NOM_DEPT": "Gers",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 31,
            "NB_COMMUNES": 463,
            "POP": 195489
        },
        {
            "CODE_REG": 72,
            "NOM_REGION": "Aquitaine",
            "CODE_DEPT": 33,
            "NOM_DEPT": "Gironde",
            "NB_ARRONDS": 6,
            "NB_CANTONS": 63,
            "NB_COMMUNES": 542,
            "POP": 1479277
        },
        {
            "CODE_REG": 91,
            "NOM_REGION": "Languedoc-Roussillon",
            "CODE_DEPT": 34,
            "NOM_DEPT": "Hérault",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 49,
            "NB_COMMUNES": 343,
            "POP": 1062617
        },
        {
            "CODE_REG": 53,
            "NOM_REGION": "Bretagne",
            "CODE_DEPT": 35,
            "NOM_DEPT": "Ille-et-Vilaine",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 53,
            "NB_COMMUNES": 353,
            "POP": 1015470
        },
        {
            "CODE_REG": 24,
            "NOM_REGION": "Centre",
            "CODE_DEPT": 36,
            "NOM_DEPT": "Indre",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 26,
            "NB_COMMUNES": 247,
            "POP": 238261
        },
        {
            "CODE_REG": 24,
            "NOM_REGION": "Centre",
            "CODE_DEPT": 37,
            "NOM_DEPT": "Indre-et-Loire",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 37,
            "NB_COMMUNES": 277,
            "POP": 605819
        },
        {
            "CODE_REG": 82,
            "NOM_REGION": "Rhône-Alpes",
            "CODE_DEPT": 38,
            "NOM_DEPT": "Isère",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 58,
            "NB_COMMUNES": 533,
            "POP": 1233759
        },
        {
            "CODE_REG": 43,
            "NOM_REGION": "Franche-Comté",
            "CODE_DEPT": 39,
            "NOM_DEPT": "Jura",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 34,
            "NB_COMMUNES": 544,
            "POP": 271973
        },
        {
            "CODE_REG": 72,
            "NOM_REGION": "Aquitaine",
            "CODE_DEPT": 40,
            "NOM_DEPT": "Landes",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 30,
            "NB_COMMUNES": 331,
            "POP": 397766
        },
        {
            "CODE_REG": 24,
            "NOM_REGION": "Centre",
            "CODE_DEPT": 41,
            "NOM_DEPT": "Loir-et-Cher",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 30,
            "NB_COMMUNES": 291,
            "POP": 340729
        },
        {
            "CODE_REG": 82,
            "NOM_REGION": "Rhône-Alpes",
            "CODE_DEPT": 42,
            "NOM_DEPT": "Loire",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 40,
            "NB_COMMUNES": 327,
            "POP": 766729
        },
        {
            "CODE_REG": 83,
            "NOM_REGION": "Auvergne",
            "CODE_DEPT": 43,
            "NOM_DEPT": "Haute-Loire",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 35,
            "NB_COMMUNES": 260,
            "POP": 231877
        },
        {
            "CODE_REG": 52,
            "NOM_REGION": "Pays de la Loire",
            "CODE_DEPT": 44,
            "NOM_DEPT": "Loire-Atlantique",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 59,
            "NB_COMMUNES": 221,
            "POP": 1317685
        },
        {
            "CODE_REG": 24,
            "NOM_REGION": "Centre",
            "CODE_DEPT": 45,
            "NOM_DEPT": "Loiret",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 41,
            "NB_COMMUNES": 334,
            "POP": 674913
        },
        {
            "CODE_REG": 73,
            "NOM_REGION": "Midi-Pyrénées",
            "CODE_DEPT": 46,
            "NOM_DEPT": "Lot",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 31,
            "NB_COMMUNES": 340,
            "POP": 181232
        },
        {
            "CODE_REG": 72,
            "NOM_REGION": "Aquitaine",
            "CODE_DEPT": 47,
            "NOM_DEPT": "Lot-et-Garonne",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 40,
            "NB_COMMUNES": 319,
            "POP": 342500
        },
        {
            "CODE_REG": 91,
            "NOM_REGION": "Languedoc-Roussillon",
            "CODE_DEPT": 48,
            "NOM_DEPT": "Lozère",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 25,
            "NB_COMMUNES": 185,
            "POP": 81281
        },
        {
            "CODE_REG": 52,
            "NOM_REGION": "Pays de la Loire",
            "CODE_DEPT": 49,
            "NOM_DEPT": "Maine-et-Loire",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 41,
            "NB_COMMUNES": 363,
            "POP": 808298
        },
        {
            "CODE_REG": 25,
            "NOM_REGION": "Basse-Normandie",
            "CODE_DEPT": 50,
            "NOM_DEPT": "Manche",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 52,
            "NB_COMMUNES": 601,
            "POP": 517121
        },
        {
            "CODE_REG": 21,
            "NOM_REGION": "Champagne-Ardenne",
            "CODE_DEPT": 51,
            "NOM_DEPT": "Marne",
            "NB_ARRONDS": 5,
            "NB_CANTONS": 44,
            "NB_COMMUNES": 620,
            "POP": 579533
        },
        {
            "CODE_REG": 21,
            "NOM_REGION": "Champagne-Ardenne",
            "CODE_DEPT": 52,
            "NOM_DEPT": "Haute-Marne",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 32,
            "NB_COMMUNES": 438,
            "POP": 191004
        },
        {
            "CODE_REG": 52,
            "NOM_REGION": "Pays de la Loire",
            "CODE_DEPT": 53,
            "NOM_DEPT": "Mayenne",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 32,
            "NB_COMMUNES": 261,
            "POP": 317006
        },
        {
            "CODE_REG": 41,
            "NOM_REGION": "Lorraine",
            "CODE_DEPT": 54,
            "NOM_DEPT": "Meurthe-et-Moselle",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 44,
            "NB_COMMUNES": 594,
            "POP": 746502
        },
        {
            "CODE_REG": 41,
            "NOM_REGION": "Lorraine",
            "CODE_DEPT": 55,
            "NOM_DEPT": "Meuse",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 31,
            "NB_COMMUNES": 500,
            "POP": 200509
        },
        {
            "CODE_REG": 53,
            "NOM_REGION": "Bretagne",
            "CODE_DEPT": 56,
            "NOM_DEPT": "Morbihan",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 42,
            "NB_COMMUNES": 261,
            "POP": 744663
        },
        {
            "CODE_REG": 41,
            "NOM_REGION": "Lorraine",
            "CODE_DEPT": 57,
            "NOM_DEPT": "Moselle",
            "NB_ARRONDS": 9,
            "NB_CANTONS": 51,
            "NB_COMMUNES": 730,
            "POP": 1066667
        },
        {
            "CODE_REG": 26,
            "NOM_REGION": "Bourgogne",
            "CODE_DEPT": 58,
            "NOM_DEPT": "Nièvre",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 32,
            "NB_COMMUNES": 312,
            "POP": 226997
        },
        {
            "CODE_REG": 31,
            "NOM_REGION": "Nord-Pas-de-Calais",
            "CODE_DEPT": 59,
            "NOM_DEPT": "Nord",
            "NB_ARRONDS": 6,
            "NB_CANTONS": 79,
            "NB_COMMUNES": 650,
            "POP": 2617939
        },
        {
            "CODE_REG": 22,
            "NOM_REGION": "Picardie",
            "CODE_DEPT": 60,
            "NOM_DEPT": "Oise",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 41,
            "NB_COMMUNES": 693,
            "POP": 823668
        },
        {
            "CODE_REG": 25,
            "NOM_REGION": "Basse-Normandie",
            "CODE_DEPT": 61,
            "NOM_DEPT": "Orne",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 40,
            "NB_COMMUNES": 505,
            "POP": 301421
        },
        {
            "CODE_REG": 31,
            "NOM_REGION": "Nord-Pas-de-Calais",
            "CODE_DEPT": 62,
            "NOM_DEPT": "Pas-de-Calais",
            "NB_ARRONDS": 7,
            "NB_CANTONS": 77,
            "NB_COMMUNES": 895,
            "POP": 1489209
        },
        {
            "CODE_REG": 83,
            "NOM_REGION": "Auvergne",
            "CODE_DEPT": 63,
            "NOM_DEPT": "Puy-de-Dôme",
            "NB_ARRONDS": 5,
            "NB_CANTONS": 61,
            "NB_COMMUNES": 470,
            "POP": 649643
        },
        {
            "CODE_REG": 72,
            "NOM_REGION": "Aquitaine",
            "CODE_DEPT": 64,
            "NOM_DEPT": "Pyrénées-Atlantiques",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 52,
            "NB_COMMUNES": 547,
            "POP": 674908
        },
        {
            "CODE_REG": 73,
            "NOM_REGION": "Midi-Pyrénées",
            "CODE_DEPT": 65,
            "NOM_DEPT": "Hautes-Pyrénées",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 34,
            "NB_COMMUNES": 474,
            "POP": 237945
        },
        {
            "CODE_REG": 91,
            "NOM_REGION": "Languedoc-Roussillon",
            "CODE_DEPT": 66,
            "NOM_DEPT": "Pyrénées-Orientales",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 31,
            "NB_COMMUNES": 226,
            "POP": 457238
        },
        {
            "CODE_REG": 42,
            "NOM_REGION": "Alsace",
            "CODE_DEPT": 67,
            "NOM_DEPT": "Bas-Rhin",
            "NB_ARRONDS": 7,
            "NB_CANTONS": 44,
            "NB_COMMUNES": 527,
            "POP": 1115226
        },
        {
            "CODE_REG": 42,
            "NOM_REGION": "Alsace",
            "CODE_DEPT": 68,
            "NOM_DEPT": "Haut-Rhin",
            "NB_ARRONDS": 6,
            "NB_CANTONS": 31,
            "NB_COMMUNES": 377,
            "POP": 765634
        },
        {
            "CODE_REG": 82,
            "NOM_REGION": "Rhône-Alpes",
            "CODE_DEPT": 69,
            "NOM_DEPT": "Rhône",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 54,
            "NB_COMMUNES": 293,
            "POP": 1756069
        },
        {
            "CODE_REG": 43,
            "NOM_REGION": "Franche-Comté",
            "CODE_DEPT": 70,
            "NOM_DEPT": "Haute-Saône",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 32,
            "NB_COMMUNES": 545,
            "POP": 247311
        },
        {
            "CODE_REG": 26,
            "NOM_REGION": "Bourgogne",
            "CODE_DEPT": 71,
            "NOM_DEPT": "Saône-et-Loire",
            "NB_ARRONDS": 5,
            "NB_CANTONS": 57,
            "NB_COMMUNES": 573,
            "POP": 574874
        },
        {
            "CODE_REG": 52,
            "NOM_REGION": "Pays de la Loire",
            "CODE_DEPT": 72,
            "NOM_DEPT": "Sarthe",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 40,
            "NB_COMMUNES": 375,
            "POP": 579497
        },
        {
            "CODE_REG": 82,
            "NOM_REGION": "Rhône-Alpes",
            "CODE_DEPT": 73,
            "NOM_DEPT": "Savoie",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 37,
            "NB_COMMUNES": 305,
            "POP": 428751
        },
        {
            "CODE_REG": 82,
            "NOM_REGION": "Rhône-Alpes",
            "CODE_DEPT": 74,
            "NOM_DEPT": "Haute-Savoie",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 34,
            "NB_COMMUNES": 294,
            "POP": 760979
        },
        {
            "CODE_REG": 11,
            "NOM_REGION": "Île-de-France",
            "CODE_DEPT": 75,
            "NOM_DEPT": "Paris",
            "NB_ARRONDS": 1,
            "NB_CANTONS": 20,
            "NB_COMMUNES": 1,
            "POP": 2268265
        },
        {
            "CODE_REG": 23,
            "NOM_REGION": "Haute-Normandie",
            "CODE_DEPT": 76,
            "NOM_DEPT": "Seine-Maritime",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 69,
            "NB_COMMUNES": 744,
            "POP": 1275952
        },
        {
            "CODE_REG": 11,
            "NOM_REGION": "Île-de-France",
            "CODE_DEPT": 77,
            "NOM_DEPT": "Seine-et-Marne",
            "NB_ARRONDS": 5,
            "NB_CANTONS": 43,
            "NB_COMMUNES": 514,
            "POP": 1347008
        },
        {
            "CODE_REG": 11,
            "NOM_REGION": "Île-de-France",
            "CODE_DEPT": 78,
            "NOM_DEPT": "Yvelines",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 39,
            "NB_COMMUNES": 262,
            "POP": 1435448
        },
        {
            "CODE_REG": 54,
            "NOM_REGION": "Poitou-Charentes",
            "CODE_DEPT": 79,
            "NOM_DEPT": "Deux-Sèvres",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 33,
            "NB_COMMUNES": 305,
            "POP": 380569
        },
        {
            "CODE_REG": 22,
            "NOM_REGION": "Picardie",
            "CODE_DEPT": 80,
            "NOM_DEPT": "Somme",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 46,
            "NB_COMMUNES": 782,
            "POP": 583388
        },
        {
            "CODE_REG": 73,
            "NOM_REGION": "Midi-Pyrénées",
            "CODE_DEPT": 81,
            "NOM_DEPT": "Tarn",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 46,
            "NB_COMMUNES": 323,
            "POP": 387099
        },
        {
            "CODE_REG": 73,
            "NOM_REGION": "Midi-Pyrénées",
            "CODE_DEPT": 82,
            "NOM_DEPT": "Tarn-et-Garonne",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 30,
            "NB_COMMUNES": 195,
            "POP": 248227
        },
        {
            "CODE_REG": 93,
            "NOM_REGION": "Provence-Alpes-Côte d'Azur",
            "CODE_DEPT": 83,
            "NOM_DEPT": "Var",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 43,
            "NB_COMMUNES": 153,
            "POP": 1026222
        },
        {
            "CODE_REG": 93,
            "NOM_REGION": "Provence-Alpes-Côte d'Azur",
            "CODE_DEPT": 84,
            "NOM_DEPT": "Vaucluse",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 24,
            "NB_COMMUNES": 151,
            "POP": 555240
        },
        {
            "CODE_REG": 52,
            "NOM_REGION": "Pays de la Loire",
            "CODE_DEPT": 85,
            "NOM_DEPT": "Vendée",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 31,
            "NB_COMMUNES": 282,
            "POP": 654096
        },
        {
            "CODE_REG": 54,
            "NOM_REGION": "Poitou-Charentes",
            "CODE_DEPT": 86,
            "NOM_DEPT": "Vienne",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 38,
            "NB_COMMUNES": 281,
            "POP": 438566
        },
        {
            "CODE_REG": 74,
            "NOM_REGION": "Limousin",
            "CODE_DEPT": 87,
            "NOM_DEPT": "Haute-Vienne",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 42,
            "NB_COMMUNES": 201,
            "POP": 384781
        },
        {
            "CODE_REG": 41,
            "NOM_REGION": "Lorraine",
            "CODE_DEPT": 88,
            "NOM_DEPT": "Vosges",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 31,
            "NB_COMMUNES": 515,
            "POP": 392846
        },
        {
            "CODE_REG": 26,
            "NOM_REGION": "Bourgogne",
            "CODE_DEPT": 89,
            "NOM_DEPT": "Yonne",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 42,
            "NB_COMMUNES": 455,
            "POP": 353366
        },
        {
            "CODE_REG": 43,
            "NOM_REGION": "Franche-Comté",
            "CODE_DEPT": 90,
            "NOM_DEPT": "Territoire de Belfort",
            "NB_ARRONDS": 1,
            "NB_CANTONS": 15,
            "NB_COMMUNES": 102,
            "POP": 146475
        },
        {
            "CODE_REG": 11,
            "NOM_REGION": "Île-de-France",
            "CODE_DEPT": 91,
            "NOM_DEPT": "Essonne",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 42,
            "NB_COMMUNES": 196,
            "POP": 1233645
        },
        {
            "CODE_REG": 11,
            "NOM_REGION": "Île-de-France",
            "CODE_DEPT": 92,
            "NOM_DEPT": "Hauts-de-Seine",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 45,
            "NB_COMMUNES": 36,
            "POP": 1590749
        },
        {
            "CODE_REG": 11,
            "NOM_REGION": "Île-de-France",
            "CODE_DEPT": 93,
            "NOM_DEPT": "Seine-Saint-Denis",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 40,
            "NB_COMMUNES": 40,
            "POP": 1534895
        },
        {
            "CODE_REG": 11,
            "NOM_REGION": "Île-de-France",
            "CODE_DEPT": 94,
            "NOM_DEPT": "Val-de-Marne",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 49,
            "NB_COMMUNES": 47,
            "POP": 1340868
        },
        {
            "CODE_REG": 11,
            "NOM_REGION": "Île-de-France",
            "CODE_DEPT": 95,
            "NOM_DEPT": "Val-d'Oise",
            "NB_ARRONDS": 3,
            "NB_CANTONS": 39,
            "NB_COMMUNES": 185,
            "POP": 1187836
        },
        {
            "CODE_REG": "01",
            "NOM_REGION": "Guadeloupe",
            "CODE_DEPT": 971,
            "NOM_DEPT": "Guadeloupe",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 40,
            "NB_COMMUNES": 32,
            "POP": 409905
        },
        {
            "CODE_REG": "02",
            "NOM_REGION": "Martinique",
            "CODE_DEPT": 972,
            "NOM_DEPT": "Martinique",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 45,
            "NB_COMMUNES": 34,
            "POP": 400535
        },
        {
            "CODE_REG": "03",
            "NOM_REGION": "Guyane",
            "CODE_DEPT": 973,
            "NOM_DEPT": "Guyane",
            "NB_ARRONDS": 2,
            "NB_CANTONS": 19,
            "NB_COMMUNES": 22,
            "POP": 231167
        },
        {
            "CODE_REG": "04",
            "NOM_REGION": "La Réunion",
            "CODE_DEPT": 974,
            "NOM_DEPT": "La Réunion",
            "NB_ARRONDS": 4,
            "NB_CANTONS": 49,
            "NB_COMMUNES": 24,
            "POP": 829903
        }
    ]

    for(let i = 0; i < population_data.length; i++){
        let dep_object = {}
        dep_object.CODE_DEPT = population_data[i].CODE_DEPT
        dep_object.POP = Math.floor(Math.random() * 7) // 0-6, 7 categories
        data.push(dep_object)
    }

    return data
}









