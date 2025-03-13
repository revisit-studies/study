/*
    WSJ Graphics common.js v1.2.0
*/

var wsjCommon = {};

/*
   ===============================
    Functions
   ===============================
*/

wsjCommon.percentageFixer = function(inNum) {
	// input: any string or floating point number representing a percentage between 0-100
	// this will handle the edge cases of < 1 and > 99 and kick them to double digit precision
	// but give single digit precision for all other cases
	// returns just the number, no % sign
	inNum = parseFloat(inNum);
	if ((inNum < 1 && inNum > 0) || (inNum > 99 && inNum < 100)) {
		outNum = inNum.toFixed(2);
	} else if (parseInt(inNum) == 100 || parseInt(inNum) == 0) {
		outNum = parseInt(inNum);
	} else {
		outNum = inNum.toFixed(1);
	}
	return outNum;
}
// if a U.S. city is a standalone dateline, you might not want to show the state
wsjCommon.isDateline = function(inCity) {
	// input: any city, case insensitive comparison
	// returns true or false
	var inCityRegex = new RegExp(inCity, "i");
	for(var i=0, len=wsjCommon.usdatelines.length; i < len; i++){
		if( wsjCommon.usdatelines[i].search(inCityRegex) !== -1) {
			return true;
		}
	}
	// else return false if no match
	return false;
}

wsjCommon.addCommas = function(nStr) {
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

wsjCommon.getQuery = function(name) {
    name = ''+ name;
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
};

/*
   ===============================
    jQuery plugins
   ===============================
*/

// Trigger a callback when 'this' image is loaded:
;(function ($) {
    $.fn.imgLoad = function (callback) {
        return this.each(function () {
            if (callback) {
                if (this.complete || /*for IE 10-*/ $(this).height() > 0) {
                    callback.apply(this);
                } else {
                    $(this).on('load', function () {
                        callback.apply(this);
                    });
                }
            }
        });
    };
})(jQuery);

/*
   ===============================
    Variables, arrays and objects
   ===============================
*/

wsjCommon.en_dash = "&#8211;";
wsjCommon.em_dash = "&#8212;";

wsjCommon.usdatelines = ['Atlanta','Baltimore','Boston','Chicago','Cincinnati','Cleveland','Dallas','Denver','Detroit','Hollywood','Honolulu','Houston','Indianapolis','Las Vegas','Los Angeles','Miami','Milwaukee','Minneapolis','New Orleans','New York','Oklahoma City','Philadelphia','Phoenix','Pittsburgh','St. Louis','Salt Lake City','San Antonio','San Diego','San Francisco','Seattle','Washington'];

wsjCommon.monthArr = {'Jan': 'Jan.', 'Feb': 'Feb.', 'Mar': 'March', 'Apr': 'April', 'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'Aug.', 'Sep': 'Sept.', 'Oct': 'Oct.', 'Nov': 'Nov.', 'Dec': 'Dec.'};

wsjCommon.monthArrIndexed = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

wsjCommon.state_names = {'AK': {'state': 'Alaska', 'postal': 'AK', 'ap': 'Alaska'}, 'AL': {'state': 'Alabama', 'postal': 'AL', 'ap': 'Ala.'}, 'AR': {'state': 'Arkansas', 'postal': 'AR', 'ap': 'Ark.'}, 'AZ': {'state': 'Arizona', 'postal': 'AZ', 'ap': 'Ariz.'}, 'CA': {'state': 'California', 'postal': 'CA', 'ap': 'Calif.'}, 'CO': {'state': 'Colorado', 'postal': 'CO', 'ap': 'Colo.'}, 'CT': {'state': 'Connecticut', 'postal': 'CT', 'ap': 'Conn.'}, 'DC': {'state': 'District of Columbia', 'postal': 'DC', 'ap': 'D.C.'}, 'DE': {'state': 'Delaware', 'postal': 'DE', 'ap': 'Del.'}, 'FL': {'state': 'Florida', 'postal': 'FL', 'ap': 'Fla.'}, 'GA': {'state': 'Georgia', 'postal': 'GA', 'ap': 'Ga.'}, 'HI': {'state': 'Hawaii', 'postal': 'HI', 'ap': 'Hawaii'}, 'IA': {'state': 'Iowa', 'postal': 'IA', 'ap': 'Iowa'}, 'ID': {'state': 'Idaho', 'postal': 'ID', 'ap': 'Idaho'}, 'IL': {'state': 'Illinois', 'postal': 'IL', 'ap': 'Ill.'}, 'IN': {'state': 'Indiana', 'postal': 'IN', 'ap': 'Ind.'}, 'KS': {'state': 'Kansas', 'postal': 'KS', 'ap': 'Kan.'}, 'KY': {'state': 'Kentucky', 'postal': 'KY', 'ap': 'Ky.'}, 'LA': {'state': 'Louisiana', 'postal': 'LA', 'ap': 'La.'}, 'MA': {'state': 'Massachusetts', 'postal': 'MA', 'ap': 'Mass.'}, 'MD': {'state': 'Maryland', 'postal': 'MD', 'ap': 'Md.'}, 'ME': {'state': 'Maine', 'postal': 'ME', 'ap': 'Maine'}, 'MI': {'state': 'Michigan', 'postal': 'MI', 'ap': 'Mich.'}, 'MN': {'state': 'Minnesota', 'postal': 'MN', 'ap': 'Minn.'}, 'MO': {'state': 'Missouri', 'postal': 'MO', 'ap': 'Mo.'}, 'MS': {'state': 'Mississippi', 'postal': 'MS', 'ap': 'Miss.'}, 'MT': {'state': 'Montana', 'postal': 'MT', 'ap': 'Mont.'}, 'NC': {'state': 'North Carolina', 'postal': 'NC', 'ap': 'N.C.'}, 'ND': {'state': 'North Dakota', 'postal': 'ND', 'ap': 'N.D.'}, 'NE': {'state': 'Nebraska', 'postal': 'NE', 'ap': 'Neb.'}, 'NH': {'state': 'New Hampshire', 'postal': 'NH', 'ap': 'N.H.'}, 'NJ': {'state': 'New Jersey', 'postal': 'NJ', 'ap': 'N.J.'}, 'NM': {'state': 'New Mexico', 'postal': 'NM', 'ap': 'N.M.'}, 'NV': {'state': 'Nevada', 'postal': 'NV', 'ap': 'Nev.'}, 'NY': {'state': 'New York', 'postal': 'NY', 'ap': 'N.Y.'}, 'OH': {'state': 'Ohio', 'postal': 'OH', 'ap': 'Ohio'}, 'OK': {'state': 'Oklahoma', 'postal': 'OK', 'ap': 'Okla.'}, 'OR': {'state': 'Oregon', 'postal': 'OR', 'ap': 'Ore.'}, 'PA': {'state': 'Pennsylvania', 'postal': 'PA', 'ap': 'Pa.'}, 'RI': {'state': 'Rhode Island', 'postal': 'RI', 'ap': 'R.I.'}, 'SC': {'state': 'South Carolina', 'postal': 'SC', 'ap': 'S.C.'}, 'SD': {'state': 'South Dakota', 'postal': 'SD', 'ap': 'S.D.'}, 'TN': {'state': 'Tennessee', 'postal': 'TN', 'ap': 'Tenn.'}, 'TX': {'state': 'Texas', 'postal': 'TX', 'ap': 'Texas'}, 'UT': {'state': 'Utah', 'postal': 'UT', 'ap': 'Utah'}, 'VA': {'state': 'Virginia', 'postal': 'VA', 'ap': 'Va.'}, 'VT': {'state': 'Vermont', 'postal': 'VT', 'ap': 'Vt.'}, 'WA': {'state': 'Washington', 'postal': 'WA', 'ap': 'Wash.'}, 'WI': {'state': 'Wisconsin', 'postal': 'WI', 'ap': 'Wis.'}, 'WV': {'state': 'West Virginia', 'postal': 'WV', 'ap': 'W.Va.'}, 'WY': {'state': 'Wyoming', 'postal': 'WY', 'ap': 'Wyo.'} };



/*
   ===============================
    Things to automatically run on initial load
   ===============================
*/

(function(){

	$(function(){
       
		// init ad on load
        ad.init();

		dropdown_swap();
		input_clear_button();
        set_moment_defaults();
	});
    
    /*
   ===============================
    Load Ad via javascript to avoid multiple calls (header/footer ad)
   ===============================
	*/

	var ad = {
    	init:function(){
			if(typeof adSection !== 'undefined' && !($('body').hasClass('template-embed'))){
				// GPT ads..
               if($('.gpt_ad_wrapper').length >= 1){
                 ad.gpt_load();
                 ad.gpt_actions();
               }
               // Double click ads
               else{
				ad.alink ='http://ad.doubleclick.net/adi/interactive.wsj.com/'+adSection+'!category=;sz=300x250;ord=8921892189218921;';
		        ad.load();
		        ad.actions();
		       }
			}
      	},
      	gpt_load:function(){
	    	// load header ad
			if($('.gpt_ad_wrapper#top_ad').css('display') == 'block' && !$('.gpt_ad_wrapper#top_ad').hasClass('adLoaded')){
	           $('.gpt_ad_wrapper#top_ad').addClass('adLoaded');
	           googletag.cmd.push(function() { googletag.display('AD_header'); });
	        }
			// load footer ad
			if($('.gpt_ad_wrapper#bottom_ad').css('display') == 'block' && !$('.gpt_ad_wrapper#bottom_ad').hasClass('adLoaded')){
	           $('.gpt_ad_wrapper#bottom_ad').addClass('adLoaded');
	           googletag.cmd.push(function() { googletag.display('AD_footer'); });
	        }
		},
		gpt_actions:function(){
			$(window).on('resize',function(){
				ad.gpt_load();
			});
		},

      	// Start -- Fall back for "Double click ads.."
	    
	    load:function(){
	    	// load header ad
			if($('.header-ad.box-ad').css('display') == 'block' && !$('.header-ad.box-ad').hasClass('adLoaded')){
	           $('.header-ad.box-ad').addClass('adLoaded');
	           $('.header-ad.box-ad iframe').attr('src',ad.alink);
	        }
			// load footer ad
			if($('.footer-ad.box-ad').css('display') == 'block' && !$('.footer-ad.box-ad').hasClass('adLoaded')){
	           $('.footer-ad.box-ad').addClass('adLoaded');
	           $('.footer-ad.box-ad iframe').attr('src',ad.alink);
	        }
		},
		actions:function(){
			$(window).on('resize',function(){
				ad.load();
			});
		}
		// End -- Fall back for "Double click ads.."
	}

	function dropdown_swap(){
		$('body').on('click', '.dropdown-menu li a', function () {
			$(this).parents('.dropdown').removeClass('open').find('button').html($(this).text() + ' <span class="caret"></span>');
			return false;
		});
	}

	function input_clear_button(){
		$('body').on('keyup paste', 'input.form-control[type="text"]', function () {
			if ($(this).val().length > 0) {
				$(this).parent().find('.btn-link.hidden').removeClass('hidden');
			} else {
				$(this).parent().find('.btn-link').addClass('hidden');
			}
		});

		$('body').on('click', '.btn-link', function () {
			if ($(this).parent().find('input.form-control[type="text"]').length > 0) {
				$(this).addClass('hidden');
				$(this).parent().find('input.form-control[type="text"]').val('').focus();
			}
		});
	}
    
    function set_moment_defaults(){
        if (typeof moment !== 'undefined') {
            moment.locale('en', {
                monthsShort : wsjCommon.monthArrIndexed,
                meridiem: function(hour, minute){
                    if (hour < 12) {
                        return 'a.m.';
                    } else {
                        return 'p.m.';
                    }
                }
            });
        }
    }

})();

/*
   ===============================
    Backwards compatibility
   ===============================
*/

;(function(){
    var oldGlobals= [ 'getQuery', 'addCommas', 'isDateline', 'percentageFixer', 'en_dash', 'em_dash', 'wsj_usdatelines', 'wsj_monthArr', 'wsj_monthArrIndexed', 'state_names' ];
    for (var i = 0; i < oldGlobals.length; i++) {
        window[oldGlobals[i]] = wsjCommon[oldGlobals[i].replace('wsj_','')];
    }
})();
