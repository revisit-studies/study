/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/*global queue, labels*/

///////////////////////////For Experiment Begin/////////////////////////////
import { Registry, initializeTrrack } from 'https://cdn.jsdelivr.net/npm/@trrack/core@1.3.0/+esm'
var registry = Registry.create();
var recordActivity = registry.register(
    "record-activity",
    (state, task) => {
        state.activeIndustry = task;
    }
);

var recordSearchActivity = registry.register(
    "record-search",
    (state, task) => {
        console.log(task,'task')
        state.search = task;
    }
);

var initialState = {
    activeIndustry:null,
    search: '',
    // visited_sequence: "", //sequence string
};

// Initialize Trrack
var trrack = initializeTrrack({
    initialState,
    registry
});

const hoverIndustry = trrack.getState().activeIndustry;
if(hoverIndustry != null)
    showTile(hoverIndustry)
else closeTile();


trrack.currentChange(() => {
    console.log(userData)
    Revisit.postAnswers({
        ["visit"]: [...userData.visitLog],
        ["search"]: [...userData.searchLog]
    });
    Revisit.postProvenance(trrack.graph.backend);
});

var userData = {
    "condition": "",
    "searchLog": [],
    "visitLog": []   //visited data table (JSON Array)
};
var currentVisit = null;
var currentSearch = null;

// For timeout
var lineHoverId = null

// Set the condition
// if (Math.random() > 0) {
//     userData.condition = "foresight";
// } else {
//     userData.condition = "control";
// }
userData.condition = "foresight";

var NAME_ATTR = 'nytlabel';

///////////////////////////For Experiment End/////////////////////////////

// Single function for put chart into specified target
function load255Chart(id) {
    // screen size detection
    userData['windowWidth'] = $(window).width();
    userData['windowHeight'] = $(window).height();

             //instructions
    if(userData.condition == "control")
    {
            d3.selectAll('.foresightTraining').style('display','none');
    }

    $(function () {
        var wholegraphic = $('<div class="whole-graphic">\n\
      <div class="graphic-wrapper"><div id="g-graphic">\n\
      <svg id="graphic-bg"></svg></div><div class="graphic-layer">\n\
      </div></div></div>');
        $("#" + id).append(wholegraphic);

        queue()
                .defer(d3.csv, "data/ces.csv")
                .defer(d3.csv, "data/wages.csv")
                .await(boot);
    });
}

window._ = _;
window.$ = $;
window.d3 = d3;
window.nytcats = {};

var theKey = $('.the-key');
var keyShown = false;

var YEARS = _.range(2004, 2015);
var BLS_HOURS_IN_WORK_YEAR = 2080;

var showPicks = true;

var display = 'all';

var prettyNumber = d3.format(',');
var prettyPct = d3.format('+%');
var prettyAccuratePct = d3.format('+.1%');
var prettyMoney = d3.format("$0,f");

var classifications = {
    'unknown': {title: 'Unclassified'},
    'unaffected': {title: 'Relatively unaffected'},
    'recovered': {title: 'Recovered'},
    'not-recovered': {title: 'Has not recovered'},
    'collapsed': {title: 'Recession accelerated decline'},
    'recovered-and-grown': {title: 'Recovered and grown'}
};

var shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
    "Sep", "Oct", "Nov", "Dec"];

var prettyMonth = function (time) {
    var month = shortMonths[time.getUTCMonth()];
    return month + (month === 'May' ? '' : '.');
};

var adjInflation = _.reduce(INFLATION, function (memo, row) {
    var pair = row.month.split('\n');
    var year = pair[1];
    var month = (_.indexOf(shortMonths, pair[0]) + 1);
    if (month < 10)
        month = '0' + month;
    var date = year + '-' + month + '-01';
    memo[date] = parseFloat(row.multiplier, 10);
    return memo;
}, {});

var totalHeightFudge = 250;

var spaceWidth, spaceHeight, spaceX, spaceY, bubbleScale, bigBubbleScale,
        strokeWidthScale, opacityScale, margin, render, lastWageMonth, missingWages,
        graphicPos, graphicWrapperPos, chartStop, firstSectionTop, lastSectionTop;


var xDomain = [8.5, 51];
var yDomain = [-0.57, 0.68];

var isMobile;

toggleMobile();

var chartWidth = isMobile ? 230 : 185;
var chartHeight = 220;

var searchData;

// Get the party started.
function boot(err, cesData, wageData) {
    if (cesData)
        window.originalCesData = cesData;
    if (wageData)
        window.originalWageData = wageData;
    processCesData();

    //search
    searchData = cesData;
    loadSearchBox();


    renderGraphic();

    bindEvents();

    transitionBetween(true);

    renderKey();

}

function loadSearchBox(){
    // Load the searchbox if foresight condition
    if(userData.condition === "foresight")
    {
        console.log('enable search')
        d3.select('#hit').select('#search-box').style('display','inline')
        enableSearch()
    }
}


function toggleMobile() {
    var isAndroid = (/Android/i).test(navigator.userAgent);
    var isIOS = (/(iPod|iPhone|iPad)/i).test(navigator.userAgent);
    var width = $(window).width();
    isMobile = !!((width <= 400) || (isAndroid && (width <= 1024)) || (isIOS && (width <= 1024)));
    $('.whole-graphic').toggleClass('is-mobile', isMobile);
}

var lowWageBreak, highWageBreak;
function wageClassify(industry) {
    var c;
    var finalWage = industry.finalWage;
    if (finalWage <= lowWageBreak) {
        c = 'low-wage';
    } else if (finalWage <= highWageBreak) {
        c = 'mid-wage';
    } else {
        c = 'high-wage';
    }
    industry.wageClassification = c;
}

function findWageBreaks(ces) {
    lowWageBreak = 17;
    highWageBreak = 35;
}

function classify(industry, data) {

    data || (data = industry.data);
    var factor = 0.06;
    var emps = _.pluck(data, 'employment');
    var index2008 = _.indexOf(YEARS, 2008) * 12;
    var index2010 = _.indexOf(YEARS, 2010) * 12;
    var recessionEmps = emps.slice(index2008, index2010);
    var preRecessionPeakEmp = _.max(emps.slice(0, _.indexOf(YEARS, 2008) * 12));
    // var yoys = [null];
    var prevEmp;
    var classification = 'unclassified';
    var yoyIndex07 = _.indexOf(YEARS, 2007) + 1;
    var yoyIndex08 = _.indexOf(YEARS, 2008) + 1;
    var yoyIndex09 = _.indexOf(YEARS, 2009) + 1;
    var gainsCount = 0;
    var lossesCount = 0;
    for (var i = 0; i < YEARS.length; i++) {
        var janEmp = emps[i * 12];
        if (prevEmp) {
            var yoy = (janEmp - prevEmp) / prevEmp;
            if (yoy > factor / 2)
                gainsCount++;
            if (yoy < -factor / 2)
                lossesCount++;
            // yoys.push(yoy);
        }
        prevEmp = janEmp;
    }
    var gainedThroughRecession = true;
    var prevMax = recessionEmps[0];
    for (var i = 1; i < recessionEmps.length; i++) {
        var cur = recessionEmps[i];
        if (cur + (cur * (factor / 5)) < prevMax) {
            gainedThroughRecession = false;
            break;
        }
        if (cur > prevMax)
            prevMax = cur;
    }
    if (gainsCount + lossesCount < 1 || lossesCount === 0 && gainedThroughRecession) {
        classification = 'unaffected';
        //e0++;
    } else if (industry.empLast > preRecessionPeakEmp + (factor * preRecessionPeakEmp)) {
        classification = 'recovered-and-grown';
        //i2++;
        // } else if (yoys[yoyIndex07] < -factor || yoys[yoyIndex08] < -factor || yoys[yoyIndex09] < -factor) {
    } else {
        if (industry.empLast > preRecessionPeakEmp - (factor * preRecessionPeakEmp)) {
            classification = 'recovered';
            //i1++;
        } else if (industry.chgSinceQ4Oh7 < factor) {
            if (industry.empFirst > industry.empdec07 + ((factor / 3) * industry.empdec07) && industry.empLast < industry.empdec09 - (industry.empdec09 * (factor / 2))) {
                classification = 'collapsed';
                //d2++;
            } else {
                classification = 'not-recovered';
                //d1++;
            }
        }
    }
    industry.classification = classification;

}


function bindEvents() {

    $(function () {
        $(window).scrollTop(0);
    });

    // $('#graphic-layer').on('mouseover', '.a-chart', mouseoverAChart);

    $('body').on('mousemove', '.is-open .a-chart, .show-table .a-chart', drawBead);

    $('body').on('mouseout', '.is-open .a-chart, .show-table .a-chart', hideBead);

    // $('.whole-graphic').on('mouseover touchstart', '.i-link', function () {
    //     //if (isMobile)
    //     //    return;
    //     closeTile();
    //     //var industry = indexedCes[$(this).attr('data-ces')];
    //     var industry = indexedCes[$(this).closest('.g-industry').attr('data-ces')];
    //     showTile(industry);

    // });

    $('#g-graphic').on('mouseover', '.emp-line', function () {
        closeTile();
        var industry = indexedCes[$(this).closest('.g-industry').attr('data-ces')];

        // If in search mode and not selected --> delay
        var waitTime = $(".whole-graphic").hasClass("search-active") && !$(this).closest('.g-industry').hasClass("search-selected") ? 500 : 0
        if (lineHoverId === null)
        {
            lineHoverId = setTimeout(showTile, waitTime, industry);
            //console.log("Set!! "+lineHoverId)
        }
        trrack.apply("hoverIndustry", recordActivity($(this).closest('.g-industry').attr('data-ces')));


        //showTile(industry);
    });

    $('#g-graphic').on('mouseout', '.emp-line', function () {
        clearTimeout(lineHoverId)
        lineHoverId = null
    });
}

function showJobs(industry, datapoint, wagepoint, el) {
    el || (el = d3.select(industry.clone || industry.element));
    var jobsEl = el.select('.info-jobs');
    var wagesEl = el.select('.info-wages');

    var current = datapoint === industry.data[industry.data.length - 1];
    if (current) {
        jobsEl.html('Current Jobs: ' + prettyNumber(Math.round(datapoint.employment)));
    } else {
        jobsEl.html('<span class="info-datebit">' + prettyMonth(datapoint.date) + "</span> " + datapoint.date.getUTCFullYear() + " Jobs: " + prettyNumber(Math.round(datapoint.employment)));
    }
    wagesEl.html("Average Salary: " + (wagepoint ? prettyMoney(wagepoint.wage * BLS_HOURS_IN_WORK_YEAR) : 'â€”'));
}

function mouseoverAChart(e) {
    console.log("mouseoverAChart");
}

function drawBead(e) {
    e.preventDefault();

    if (isMobile)
        return;

    var industry = this.industry;
    var offset = $(this).offset();
    var x = e.pageX - offset.left;
    var y = e.pageY - offset.top;
    var xDate = chartX.invert(x - cMargin.left);
    var datapoint, wagepoint;
    for (var i = 0; i < industry.data.length; i++) {
        if (industry.data[i].date >= xDate) {
            datapoint = industry.data[i];
            wagepoint = industry.wages[i - missingWages];
            break;
        }
    }
    if (!datapoint) {
        datapoint = industry.data[industry.data.length - 1];
        wagepoint = industry.wages[industry.wages.length - 1];
    }
    var empSecond = industry.data[1].employment;
    var neg = datapoint.employment < industry.empFirst || (datapoint.employment === industry.empFirst && empSecond < industry.empFirst);
    var x = chartX(datapoint.date);
    var y = industry.chartY(datapoint.employment);
    var el = d3.select(industry.clone);
    var bead = el.select('.a-bead');
    // bead.attr('cx', x).attr('cy', y);
    bead.attr("transform", "translate(-2.5, 0) translate(" + (x + (neg ? 4 : 0)) + "," + (y + (neg ? 7 : -7)) + ") rotate(" + (neg ? 180 : 0) + ")");
    showJobs(industry, datapoint, wagepoint, el);

    //Record user data
    if (currentVisit) {
        currentVisit['mousemove']++;
    }
}

function hideBead(e) {
    if (isMobile)
        return;
    var industry = this.industry;
    var el = d3.select(industry.clone || industry.element);
    showJobs(industry, industry.data[industry.data.length - 1], industry.wages[industry.wages.length - 1], el);

}

var openTile = null;
function closeTile() {
    if (isMobile)
        return;
    $(window).off('mouseover', closeTile);
    if (openTile) {
        recordVisit(null); //record the current visit

        //close tile
        openTile.original.removeClass('no-label');
        openTile.removeClass('is-open');
        openTile.industry.clone = null;
        var openTileRef = openTile;
        _.delay(function () {
            openTileRef.remove();
        }, 500);

    }
    openTile = null;
    //check
    trrack.apply("hoverIndustry", recordActivity(null));
}

function showTile(industry) {
    if (isMobile)
        return;
    var el = $(industry.element);
    var clone = el.clone();

    clone.industry = industry;
    industry.clone = clone[0];
    clone.original = el;
    el.addClass('no-label');
    $('.graphic-layer').append(clone);
    clone.find('.a-chart')[0].industry = industry;
    _.defer(function () {
        clone.addClass('is-open');
    });
    openTile = clone;
    clone.on('mouseover', function () {
        return false;
    });
    _.defer(function () {
        $(window).on('mouseover', closeTile);
    });

    // Set visit
    recordVisit(industry['nytlabel'])
}

function recordVisit(item) {

    // record previous
    if(currentVisit && currentVisit['chartCode'] !== item){
        currentVisit['end'] = Date.now()
        currentVisit['duration'] = currentVisit['end'] - currentVisit['start'];
        userData['visitLog'].push(currentVisit);
        currentVisit = null;
        //console.log(userData['visitLog'])
    }

    // start a new visit
    if(!currentVisit && item){
        //console.log(item)
        currentVisit = {}
        currentVisit['start'] = Date.now();
        currentVisit['chartCode'] = item;
        currentVisit['searchId'] = currentSearch ? currentSearch['id'] : -1;
        currentVisit['mousemove'] = 0;
    }
}


function eachMonth(callback) {
    _.each(YEARS, function (year) {
        _.each(_.range(1, 13), function (month) {
            if (year >= 2014 && month > 4)
                return;
            if (month < 10)
                month = "0" + month;
            var dateString = year + '-' + month + '-01';
            var date = new Date(Date.parse(dateString));
            callback(dateString, date);
        });
    });
}

    // var i2 = 0;
    // var i1 = 0;
    // var e0 = 0;
    // var d1 = 0;
    // var d2 = 0;

function processCesData() {


    var ces = originalCesData;
    var wages = _.indexBy(originalWageData, function (row) {
        return row.seriesid.replace(/(^CES0?|03$)/g, '');
    });
    for (var i = 0; i < ces.length; i++) {
        var row = ces[i];
        row.data = [];
        row.wages = [];
        row.bbox = {};
        if (row.alternacategory) {
            row.alternacategory = row.alternacategory.split(/, ?/g);
        }
        nytcats[row.nytcategory] = true;
        eachMonth(function (dateString, date) {
            row.data.push({
                datestr: dateString,
                date: date,
                employment: (+row[dateString]) * 1000
            });
            if (!wages[row.cescode])
                return;
            var avgWage = wages[row.cescode][dateString];
            if (avgWage) {
                if (!adjInflation[dateString])
                    throw new Error("no wage " + row.cescode + ' ' + row.industry + ' ' + dateString);
                avgWage = adjInflation[dateString] * parseFloat(avgWage, 10);
                row.wages.push({
                    datestr: dateString,
                    date: date,
                    wage: avgWage
                });
            }
        });
        row.alignedData = _.filter(row.data, function (d) {
            return d.date >= new Date('2007-12-01');
        });
        row.empFirst = row.data[0].employment;
        row.empLast = row.data[row.data.length - 1].employment;
        row.empdec07 = _.where(row.data, {datestr: '2007-12-01'})[0].employment;
        row.empdec09 = _.where(row.data, {datestr: '2009-12-01'})[0].employment;
        row.chgSinceQ4Oh7 = (row.empLast - row.empdec07) / row.empdec07;

        if (row.wages.length) {
            row.firstWage = row.wages[0].wage;
            row.finalWage = row.wages[row.wages.length - 1].wage;
            row.finalSalary = row.finalWage * BLS_HOURS_IN_WORK_YEAR;
        }
        if (!row.wages.length) {
            console.warn("No Wage For: ", row.industry);
        }
        classify(row);
    }

    // console.log(i2)
    // console.log(i1)
    // console.log(e0)
    // console.log(d1)
    // console.log(d2)

    findWageBreaks(ces);
    _.each(ces, wageClassify);

    if (showPicks) {
        ces = _.where(ces, {showrow: '1'});
    }

    lastWageMonth = ces[0].alignedData.length - 1;
    missingWages = ces[0].data.length - ces[0].wages.length;

    chartX = d3.time.scale()
            .rangeRound([0, cWidth])
            .domain(d3.extent(ces[0].data, function (d) {
                return d.date;
            }));

    window.nytcats = _.compact(_.keys(nytcats));
    window.cesData = ces;
    window.indexedCes = _.indexBy(ces, 'cescode');
}

function renderGraphic() {
    // CES
    $('.g-industries').remove();
    var list = $('<div class="g-industries"></div>');
    $("#g-graphic").append(list);
    renderIndustry(list, cesData, true);
    renderCharts(cesData);
}

function renderIndustry(list, data) {
    _.each(data, function (industry) {
        var name = (industry.nytlabel || industry.industry);
        var item = $('<div class="g-industry" data-ces="' + industry.cescode + '"><div class="industry-header"><span class="industry-title">' + name + '</span><div class="industry-info"></div></div><div class="svgwrap"><svg class="a-chart"></svg></div></div>');
        industry.element = item[0];
        item.find('.a-chart')[0].industry = industry;
        var label = labels[industry.cescode];
        if (label) {
            label.el = $('<div class="industry-label ' + (label.klass || '') + '" style="margin-left: ' + (label.left || 0) + 'px; margin-top: ' + (label.top || 0) + 'px;">' + name + '</div>');
            item.append(label.el);
        }
        industry.label = label;
        list.append(item);
        if (industry.sub && industry.sub.length) {
            var childList = $('<ul></ul>');
            item.append(childList);
            renderIndustry(childList, industry.sub);
        }
    });
}

function renderCharts(industries) {

    margin = {
        top: 140, left: 50, bottom: 50, right: 0
    };

    render = window.render = function () {

        // Set minimum width and height
        var everythingHeight = $(window).height() - totalHeightFudge;
        var everythingWidth = $(window).width()

        if (everythingHeight < 800)
            everythingHeight = 800;
        if(everythingWidth < 800)
            everythingWidth = 800

        $('#g-graphic, .graphic-layer').css({height: everythingHeight, width: everythingWidth});

        spaceWidth = $('#g-graphic').width();
        spaceHeight = $('#g-graphic').height();

        spaceX = d3.scale.linear()
                // .domain(empExtent)
                .domain(xDomain)
                .rangeRound([margin.left * 1.3, spaceWidth - (margin.left * 1.3) - (margin.right)]);

        spaceY = d3.scale.linear()
                // .domain(d3.extent(industries, function(d){ return d.chgSinceQ4Oh7; }))
                .domain(yDomain)
                .rangeRound([spaceHeight - margin.bottom, margin.top]);


        for (var i = 0; i < industries.length; i++) {
            renderChart(industries[i]);
        }

        renderLegend();
        togglePlacement();
    };

    render();

    window.render = render;

}

function togglePlacement() {

    var month = lastWageMonth;

    //container.toggleClass('at-origin', false);
    _.each(cesData, function (row) {
        place(row, month);
        move(row);

    });
}
window.togglePlacement = togglePlacement;

function place(industry, month) {
    var wage = industry.wages[month].wage;
    var emp = industry.alignedData[month].employment;
    var chgEmp = (emp - industry.empdec07) / industry.empdec07;
    industry.spaceX = spaceX(wage) - industry.bbox.cx + industry.xFudge;
    // industry.spaceX = spaceX(emp) - industry.bbox.cx + industry.xFudge;
    industry.spaceY = spaceY(chgEmp) - industry.bbox.cy + industry.yFudge;
    industry.x = industry.finalX = industry.spaceX;
    industry.y = industry.finalY = industry.spaceY;
    // industry.radius = bigBubbleScale(emp);
}

function move(industry) {
    $(industry.element).css({
        transform: 'translate(' + Math.round(industry.x) + 'px, ' + Math.round(industry.y) + 'px)'
    });
}

function transitionBetween() {
    setSector();
}

function setSector() {
    var top = 0;
    //var realSector = currentSector != noSector;
    var realSector = false;
    //display == all
    top = $('#g-graphic').offset().top;

    for (var i = 0; i < cesData.length; i++) {
        var industry = cesData[i];
        var active = !realSector;
        if (!active) {
            for (var j = 0; j < industry.alternacategory.length; j++) {
                if (industry.alternacategory[j] == currentSector) {
                    active = true;
                }
            }
        }
        var klass = active ? 'is-active' : 'not-active';
        var labelIsActive = industry.label && (!!((realSector && active) || (!realSector && industry.label.all)));
        if (labelIsActive !== industry.labelIsActive)
            industry.label.el.toggleClass('is-active', labelIsActive);
        if (industry.line && (industry.lineIsActive !== active))
            industry.line.attr('class', 'emp-line emp-realline ' + klass);
        industry.labelIsActive = labelIsActive;
        industry.lineIsActive = active;
    }


}





var MARGIN_UP = 102;
var cMargin = {top: 10 + MARGIN_UP, right: 5, bottom: 16, left: 35},
        cWidth = chartWidth - cMargin.left - cMargin.right,
        cHeight = chartHeight - cMargin.top - cMargin.bottom;

var chartX;

function renderChart(industry) {

    if (industry.rendered)
        return;

    industry.rendered = true;
    var data = industry.data;
    var el = $(industry.element);

    if (!data.length) {
        el.find('svg').replaceWith('<div class="apology">Only rendering the private sector at the moment</div>');
        return;
    }

    var classification = classifications[industry.classification];

    var emp1 = industry.empFirst;
    var empLast = industry.empLast;
    var q4change = industry.chgSinceQ4Oh7;

    el.addClass(industry.classification);
    el.addClass(industry.wageClassification);

    var info = el.find('.industry-info');

    if (classification) {
        info.append('<div class="info-span classification ' + industry.classification + '">' + classification.title + '</div>');
    }
    info.append('<div class="info-span info-jobs">Current Jobs: ' + prettyNumber(Math.round(empLast)) + '</div>');
    info.append('<div class="info-span info-wages">Average Salary: ' + prettyMoney(industry.finalSalary) + '</div>');


    var yExtent = d3.extent(data, function (d) {
        return d.employment;
    });
    var goesABitNeg = (yExtent[0] - emp1) < (-0.2 * emp1);
    var goesALotNeg = (yExtent[0] - emp1) < (-0.4 * emp1);
    var goesABitPos = (yExtent[1] - emp1) > (0.2 * emp1);
    var goesALotPos = (yExtent[1] - emp1) > (0.4 * emp1);
    if (goesALotNeg && !goesABitPos) {
        var yDomain = [emp1 - (emp1 * 0.7), emp1 + (emp1 * 0.1)];
    } else if (goesALotPos && !goesABitNeg) {
        var yDomain = [emp1 - (emp1 * 0.1), emp1 + (emp1 * 0.7)];
    } else {
        var yDomain = [emp1 - (emp1 * 0.4), emp1 + (emp1 * 0.4)];
    }
    var chartY = d3.scale.linear()
            .rangeRound([cHeight, 0])
            .domain(yDomain);
    industry.chartY = chartY;

    var xAxis = d3.svg.axis()
            .scale(chartX)
            .tickValues(_.map(['2004-01-01', '2009-01-01', '2013-01-01'], function (d) {
                return new Date(Date.parse(d));
            }))
            .tickFormat(function (d) {
                return d.getUTCFullYear();
            })
            .orient("bottom");

    var yAxis = d3.svg.axis()
            .scale(chartY)
            .tickValues([yDomain[0], emp1, yDomain[1]])
            .tickSize(0)
            .tickFormat(function (d, i) {
                return prettyPct((d - emp1) / emp1);
            })
            .orient("left");

    var lineArea = d3.svg.area()
            .x(function (d) {
                return chartX(d.date);
            })
            .y(function (d) {
                return chartY(d.employment);
            })
            .interpolate('basis');

    var area = d3.svg.area()
            .x(function (d) {
                return chartX(d.date);
            })
            .y0(chartY(emp1))
            .y1(function (d) {
                return chartY(d.employment);
            });

    var theChartWidth = cWidth + cMargin.left + cMargin.right;
    var theChartHeight = cHeight + cMargin.top + cMargin.bottom;

    $(industry.element).find('.svgwrap').css({
        width: theChartWidth,
        height: theChartHeight - MARGIN_UP
    });

    var svg = d3.select(industry.element).select('svg')
            .attr('width', theChartWidth)
            .attr('height', theChartHeight)
            .style('top', 0);

    var g = svg.append('g')
            .attr("transform", "translate(" + cMargin.left + "," + cMargin.top + ")");

    g.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + cHeight + ")")
            .call(xAxis);

    g.append("g")
            .attr("class", "y axis")
            .call(yAxis);


    var line = g.append("path")
            .datum(data)
            .attr("class", "emp-line emp-realline")
            .style('stroke-width', 2)
            .style('fill', 'none')
            .attr("d", lineArea);

    if (userData.condition == "fade")
    {
        /***For encoding: opacity***/
        line.style('opacity', 0.4);
    }
    industry.line = line;


    g.append("path")
            .datum(data)
            .attr("class", "emp-area")
            .attr("d", area)
    //.style("display","none");


    // d3.selectAll("svg.a-chart g")
    //         .on("mouseover", function (d) {
    //             d3.select(this).classed("hover", true);
    //         })
    //         .on("mouseout", function (d) {
    //             d3.select(this).classed("hover", false);
    //         });

    var bead = g.append('g')
            .attr("transform", "translate(-1000,-1000)")
            .attr('class', 'a-bead');
    bead.append('path')
            .attr('d', 'M 0 0 L 2.5 4 L 5 0 Z');

    g.append('rect')
            .attr('class', 'recession-block')
            .attr('x', chartX(new Date('2007-12-01')))
            .attr('y', -10)
            .attr('width', chartX(new Date('2009-06-01')) - chartX(new Date('2007-12-01')))
            .attr('height', cHeight + 10)
            .attr('fill', 'rgba(255,0,0,0.1)');

    var bbox = industry.bbox;
    bbox.x1 = cMargin.left;
    bbox.x2 = cMargin.left + cWidth;

    var topYpx = chartY(yExtent[1]);
    var bottomYpx = chartY(yExtent[0]);

    // Circle bbox.
    var yBasis = cMargin.top;
    bbox.y1 = yBasis + topYpx;
    bbox.y2 = yBasis + bottomYpx;

    bbox.height = bbox.y2 - bbox.y1;
    bbox.width = bbox.x2 - bbox.x1;
    bbox.cx = bbox.x1 + (bbox.width / 2);
    bbox.cy = bbox.y1 + (bbox.height / 2);

    industry.xFudge = 0;
    industry.yFudge = 0;

    //showTile(industry);//for debug
}

function toggleKey() {
    if (!keyShown) {
        theKey.css({opacity: 1});
        keyShown = true;
    } else if (keyShown) {
        theKey.css({opacity: 0});
        keyShown = false;
    }
}

function renderKey() {
    var dim = 40;
    $('.arrow-key').each(function () {
        var down = $(this).hasClass('down');
        var right = !down;
        var g = d3.select(this).append('svg')
                .attr('width', dim)
                .attr('height', dim)
                .append('g');

        g.append("svg:defs").selectAll("marker")
                .data(["arrow"])
                .enter().append("svg:marker")
                .attr("id", String)
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 0)
                .attr("refY", 0)
                .attr("markerWidth", 10)
                .attr("markerHeight", 10)
                .attr("orient", "auto")
                .append("svg:path")
                .attr("d", "M 0,-4 L 10,0 L 0,4 ");

        g.append("svg:line")
                .attr("x1", down ? dim / 2 : 0)
                .attr("y1", down ? 0 : dim / 2)
                .attr("x2", down ? dim / 2 : dim - 10)
                .attr("y2", down ? dim - 10 : dim / 2)
                .attr("class", "key-arrow")
                .attr("marker-end", "url(#arrow)");
    });
}

// Function for renderring axis and middle line
var legendG;
function renderLegend() {
    var w = spaceWidth, h = spaceHeight;
    if (legendG)
        legendG.remove();
    legendG = d3.select('#graphic-bg')
            .attr('width', w)
            .attr('height', h)
            .append('g');

    legendG.append('rect')
            .attr('class', 'legend-gray')
            .attr('x', 55)
            .attr('y', 50)
            .attr('width', w - 105)
            .attr('height', h - 100);

    legendG.append('path')
            .attr('class', 'h-line')
            .attr('d', 'M ' + (margin.left - 10) + ' ' + spaceY(0) + ' L ' + (w - 35) + ' ' + spaceY(0));

    var labelFudge = 20;

    renderAxis(margin.left - 30, spaceY(0) - 82, 'Jobs since recession', 'Increased', true, true);
    renderAxis(margin.left - 30, spaceY(0) + 82, null, 'Decreased', false, true);
    renderAxis(w / 2 - 55, h - margin.bottom + 35, 'Industries', 'Lower Wages', true, false);
    renderAxis(w / 2 + 55, h - margin.bottom + 35, null, 'Higher Wages', false, false);

    function renderAxis(x, y, centerText, text, arrowDir, axisDir) {
        if (centerText) {
            var cx = axisDir ? x : (w / 2);
            var cy = axisDir ? (spaceY(0)) : y;
            legendG.append('text')
                    .attr('class', 'legend-text center-text')
                    .attr('text-anchor', 'middle')
                    .attr('transform', 'translate(' + cx + ',' + cy + ') ' + (axisDir ? 'rotate(270)' : ''))
                    .text(centerText);
        }

        legendG.append('text')
                .attr('class', 'legend-text')
                .attr('text-anchor', (arrowDir ? axisDir : !axisDir) ? 'start' : 'end')
                .attr('transform', 'translate(' + x + ',' + y + ') ' + (axisDir ? 'rotate(270)' : ''))
                .text(text);

        legendG.append("svg:defs").selectAll("marker")
                .data(["arrow"])
                .enter().append("svg:marker")
                .attr("id", String)
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 0)
                .attr("refY", 0)
                .attr('stroke-width', 0)
                .attr("markerWidth", 12)
                .attr("markerHeight", 10)
                .attr("orient", "auto")
                .append("svg:path")
                .attr("d", "M 0,-3 L 11,0 L 0,3 ");

        if (axisDir) {
            var y1 = (arrowDir ? -68 : 70);
            legendG.append("svg:line")
                    .attr("x1", x - 4)
                    .attr("y1", y + y1)
                    .attr("x2", x - 4)
                    .attr("y2", y + y1 + (arrowDir ? -22 : 22))
                    .attr("class", "legend-arrow")
                    .attr("marker-end", "url(#arrow)");
        } else {
            var x1 = (arrowDir ? -90 : 93);
            legendG.append("svg:line")
                    .attr("x1", x + x1)
                    .attr("y1", y - 4)
                    .attr("x2", x + x1 + (arrowDir ? -22 : 22))
                    .attr("y2", y - 4)
                    .attr("class", "legend-arrow")
                    .attr("marker-end", "url(#arrow)");
        }
    }
    ;
}
;

// Re-render chart when window resize
$(window).on('resize', _.debounce(function () {
    userData['windowWidth'] = $(window).width();
    userData['windowHeight'] = $(window).height();
    window.render();
}, 50));

function recordSearch(query){
        // record the previous one
        if(currentSearch != null)
        {
            currentSearch.end = Date.now();
            currentSearch.duration = currentSearch.end - currentSearch.start;
            userData.searchLog.push(currentSearch);
            currentSearch = null
            //debug log
            //console.log("searchLog=")
            //console.log(userData.searchLog)
        }
        // start a new one
        if(!currentSearch && query){
            //console.log(query)
            currentSearch = {}
            currentSearch['id'] = userData['searchLog'].length;
            currentSearch['start'] = Date.now();

            currentSearch['selectedCharts'] = 0;
        }
        console.log('search')
        console.log(query,'query')
        trrack.apply("useSearch", recordSearchActivity(query));


}


// Search box
function enableSearch(){

    var searchInput = $("#search-input");

    // Get options for auto complete
    function getSearchOptions(data) {
        var optionsData = [];
            if (data && data.length > 0) {
                for (var i = 0; i < data.length; i++) {
                    optionsData.push(data[i]['nytlabel']);
                }
            }
            initSearchBox(optionsData);
    }
    getSearchOptions(searchData);

    // Init search box with auto complete
    function initSearchBox(options) {
        // Invoke auto complete for search box
        var searchOptions = {
            data: options,
            list: {
                maxNumberOfElements: 300,
                match: {enabled: true},
                onChooseEvent: function () {
                    searchChooseItem();
                }
            }
        };
        searchInput.easyAutocomplete(searchOptions);

        // Start searching when typing in search box
        searchInput.on("input", function (e) {
            e.preventDefault();
            searchChooseItem();
        });
    }

    // Search choosen item
    function searchChooseItem() {
        searchFilter(searchInput.val().toLowerCase());
    }

    function searchFilter(value) {

        recordSearch(value);

        // Reset and return if empty
        if (value === "") {
            resetSearch();
            return;
        }

        // Start Filtering
        // Fade all lines and boxes
        $(".g-industry").removeClass("search-selected");
        $(".whole-graphic").addClass("search-active");

        // Make contains case-insensitive
        $.expr[":"].contains = $.expr.createPseudo(function (arg) {
            return function (elem) {
                return $(elem).text().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
            };
        });

        // Unfade selected elements
        var selectedCharts = $(".industry-title:contains('" + value + "')")
        if (value && selectedCharts) {
            // Unfade
            selectedCharts
                    .closest(".g-industry")
                    .addClass("search-selected");
            // Record current search
            currentSearch.selectedCharts = selectedCharts.length
            //console.log("searching for: "+currentSearch.content+" #="+currentSearch.selectedCharts)
        }



    }
    // Click button to reset
    $("#search-reset").click(function () {
        resetSearch();
    });

    // Press ESC to reset
    $(document).keydown(function (e) {
        if (e.which === 27) //ESC
            resetSearch();
    });

    function resetSearch() {
        // Reset faded elemnets
        $(".whole-graphic").removeClass("search-active");
        $(".g-industry").removeClass("search-selected");
        // Reset search
        recordSearch(null)
        currentSearch = null;
        // Clear search input box
        searchInput.val("");
    }

    Revisit.onProvenanceReceive((prov)=>{
        console.log(prov)

        closeTile()
        const hoverIndustry = indexedCes[prov.activeIndustry];
        const searchKeyword = prov.search;
        if(hoverIndustry != null){
            showTile(hoverIndustry)
        }
        searchFilter(searchKeyword)
        $("#search-input").val(searchKeyword);

    })

};

export {
    load255Chart,
    boot,
    toggleMobile,
    wageClassify,
    findWageBreaks,
    classify,
    bindEvents,
    showJobs,
    mouseoverAChart,
    drawBead,
    hideBead,
    closeTile,
    showTile,
    eachMonth,
    processCesData,
    renderGraphic,
    renderIndustry,
    renderCharts,
    togglePlacement,
    place,
    move,
    transitionBetween,
    setSector,
    renderChart,
    toggleKey,
    renderKey,
    renderLegend,
    recordSearch,
    enableSearch,
    searchData,
    userData
};

