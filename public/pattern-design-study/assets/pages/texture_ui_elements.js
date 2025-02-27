

    /**
     * UI elements of geometric texture charts
     */

    const resetBtn = document.getElementById("resetBtn")
    const dataBtn = document.getElementById("dataBtn")
    const defaultDataBtn = document.getElementById('defaultDataBtn')

    var parametersList
    var parameters


    const undoBtn = document.getElementById("undoBtn")
    const redoBtn = document.getElementById("redoBtn")
    const saveParametersBtn = document.getElementById("saveParameters")

    /* Controllers */
//pattern type: line, dot, grid
    const lineRadio = document.getElementById("lineRadio")
    const dotRadio = document.getElementById("dotRadio")
    const gridRadio = document.getElementById("gridRadio")
    const patternTypeRadios = document.getElementsByClassName("patternTypeRadio")
    const patternType = [] //pattern type for each category

//line texture controllers
    const controlLineDensity = document.getElementById("controlLineDensity")
    const controlLineRotate = document.getElementById("controlLineRotate")
    const controlLineStrokeWidth = document.getElementById("controlLineStrokeWidth")
    const controlLineX = document.getElementById("controlLineX")
    const controlLineY = document.getElementById("controlLineY")

    const controlLineAngle0 = document.getElementById("controlLineAngle0")
    const controlLineAngle45 = document.getElementById("controlLineAngle45")
    const controlLineAngle90 = document.getElementById("controlLineAngle90")
    const controlLineAngle135 = document.getElementById("controlLineAngle135")

    const controlLineBackgroundWhite = document.getElementById("controlLineBackgroundWhite")
    const controlLineBackgroundBlack = document.getElementById("controlLineBackgroundBlack")
    const controlLineBackgroundRadios = document.getElementsByClassName("controlLineBackgroundRadio")


    var lineBackground = []

    const lineControllers = document.getElementsByClassName("lineController")

//dot texture controllers
    const controlDotDensity = document.getElementById("controlDotDensity")
    const controlDotRotate = document.getElementById("controlDotRotate")
    const controlDotSize = document.getElementById("controlDotSize")
    const controlDotX = document.getElementById("controlDotX")
    const controlDotY = document.getElementById("controlDotY")

    const controlDotAngle0 = document.getElementById("controlDotAngle0")
    const controlDotAngle45 = document.getElementById("controlDotAngle45")

    const controlDotBackgroundWhite = document.getElementById("controlDotBackgroundWhite")
    const controlDotBackgroundBlack = document.getElementById("controlDotBackgroundBlack")
    const controlDotBackgroundRadios = document.getElementsByClassName("controlDotBackgroundRadio")


    var dotBackground = []

    const controlDotPrimitiveDot = document.getElementById("controlDotPrimitiveDot")
    const controlDotPrimitiveCircle = document.getElementById("controlDotPrimitiveCircle")
    const controlDotPrimitiveRadios = document.getElementsByClassName("controlDotPrimitiveRadio")

    var dotPrimitive = []

    const controlDotPrimitiveStrokeWidth = document.getElementById("controlDotPrimitiveStrokeWidth")

    const dotControllers = document.getElementsByClassName("dotController")


//grid texture controllers
    const controlGridDensity = document.getElementById("controlGridDensity")
    const controlGridStrokeWidth = document.getElementById("controlGridStrokeWidth")
    const controlGridX = document.getElementById("controlGridX")
    const controlGridY = document.getElementById("controlGridY")


    const controlGridAngle = document.getElementById("controlGridAngle")

    const controlGridAngle15 = document.getElementById("controlGridAngle15")
    const controlGridAngle30 = document.getElementById("controlGridAngle30")
    const controlGridAngle45 = document.getElementById("controlGridAngle45")

    const controlGridRotate = document.getElementById("controlGridRotate")
    const controlGridRotate30 = document.getElementById("controlGridRotate30")
    const controlGridRotate45 = document.getElementById("controlGridRotate45")
    const controlGridRotate60 = document.getElementById("controlGridRotate60")


    const gridControllers = document.getElementsByClassName("gridController")

    const controlGridBackgroundWhite = document.getElementById("controlGridBackgroundWhite")
    const controlGridBackgroundBlack = document.getElementById("controlGridBackgroundBlack")
    const controlGridBackgroundRadios = document.getElementsByClassName("controlGridBackgroundRadio")

    const gridBackground = []


//outline controller
    const controlOutline = document.getElementById("controlOutline")

// /* Indicator */
    if(document.getElementsByClassName("indicator")){
        var indicators = document.getElementsByClassName("indicator") // we will create indicators later
    }
    var indicatorX = [] // transform x for each indicator
    var indicatorY = [] // transoform y for each indicator

    const legendIndicators = document.getElementsByClassName("legendIndicator") //indicators beside legends
    var legendIndicatorX = []
    var legendIndicatorY = []

    /* Legend */
    const legendLabels = document.getElementsByClassName("legendLabel") //texts in legends

    /**
     * UI elements of iconic texture charts
     */
    /* Pattern */
    var iconPattern //<pattern> for iconPattern
    var iconBackground




    /* Icon Style */
//radio button for each icon style
    const stroke = document.getElementById("strokeRadio")
    const detail = document.getElementById("detailRadio")
    const simpleStroke = document.getElementById('simpleStrokeRadio')
    const simpleFill = document.getElementById('simpleFillRadio')


    const iconStyleRadios = document.getElementsByClassName("iconStyleRadio") //list of all icon style radio button

//list of all icon style
    const iconStyleList = ["stroke", "detail",'simple_stroke','simple_fill']

//images for each icon style
    const strokeImg = document.getElementById("strokeImg")
    const detailImg = document.getElementById("detailImg")
    const simpleStrokeImg = document.getElementById('simpleStrokeImg')
    const simpleFillImg = document.getElementById('simpleFillImg')


//icon style for each bar
    var iconStyle = [] // list for all bars' icon style. iconStyle[i] = 1 means i-th bar's icon style is "detail"

    /* Controllers */
    const controlDensity = document.getElementById("controlDensity")
    const controlSize = document.getElementById("controlSize")
    const controlX = document.getElementById("controlX")
    const controlY = document.getElementById("controlY")
    const controlRotateIcon = document.getElementById("controlRotateIcon")
    const controlRotate = document.getElementById("controlRotate")
    const controlAngle0 = document.getElementById("controlAngle0")
    const controlAngle90 = document.getElementById("controlAngle90")

    const controlBackgroundWhite = document.getElementById("controlBackgroundWhite")
    const controlBackgroundBlack = document.getElementById("controlBackgroundBlack")
    const controlBackgroundRadios = document.getElementsByClassName("controlBackgroundRadio")

    var iconBackground = []


    const same = document.getElementsByClassName("same")

// /* Indicator */ -- TODO: Geo和Icon Legend 部分重复了？
    if(document.getElementsByClassName("indicator")){
        var indicators = document.getElementsByClassName("indicator") // we will create indicators later
    }
    var indicatorX = [] // transform x for each indicator
    var indicatorY = [] // transoform y for each indicator

// const legendIndicators = document.getElementsByClassName("legendIndicator") //indicators beside legends

    /* Legend */
    const legendImgs = document.getElementsByClassName("legendImg")

// const legendLabels = document.getElementsByClassName("legendLabel") //texts in legends

const selectDefaultTexture = document.getElementById("selectDefaultTexture")


    const controlHalo = document.getElementById("controlHalo")
