/*!
* jQuery.hook v1.0
*
* Copyright (c) 2009 Aaron Heckmann
* Dual licensed under the MIT and GPL licenses:
* http://www.opensource.org/licenses/mit-license.php
* http://www.gnu.org/licenses/gpl.html
*/
/**
* Provides the ability to hook into any jQuery.fn[method]
* with onbeforeMETHOD, onMETHOD, and onafterMETHOD. 
*
* Pass in a string or array of method names you want 
* to hook with onbefore, on, or onafter. 
*
* Example: 
* 	jQuery.hook('show');
*	jQuery(selector).bind('onbeforeshow', function (e) { alert(e.type);});
*   jQuery(selector).show() -> alerts 'onbeforeshow'
*
*   jQuery.hook(['show','hide']);
*   jQuery(selector)
*       .bind('onbeforeshow', function (e) { alert(e.type);})
*       .bind('onshow', function (e) { alert(e.type);})
*       .bind('onaftershow', function (e) { alert(e.type);})
*       .bind('onafterhide', function (e) { alert("The element is now hidden.");});
*   jQuery(selector).show().hide()
*        -> alerts 'onbeforeshow' then alerts 'onshow', then alerts 'onaftershow',
*             then after the element is hidden alerts 'The element is now hidden.'
*
*
* You can also unhook what you've hooked into by calling jQuery.unhook() passing
* in your string or array of method names to unhook.
*
*/
(function($){
	$.hook = function (fns) {
		fns = typeof fns === 'string' ? 
			fns.split(' ') : 
			$.makeArray(fns)
		;
		
		jQuery.each( fns, function (i, method) {
			var old = $.fn[ method ];
			
			if ( old && !old.__hookold ) {
				
				$.fn[ method ] = function () {
					this.triggerHandler('onbefore'+method);
					this.triggerHandler('on'+method);
					var ret = old.apply(this, arguments);
					this.triggerHandler('onafter'+method);
					return ret;
				};
				
				$.fn[ method ].__hookold = old;
				
			}
		});	
			
	};
	
	$.unhook = function (fns) {
		fns = typeof fns === 'string' ? 
			fns.split(' ') : 
			$.makeArray(fns)
		;
		
		jQuery.each( $.makeArray(fns), function (i, method) {
			var cur = $.fn[ method ];
			
			if ( cur && cur.__hookold ) {				
				$.fn[ method ] = cur.__hookold;			
			}
		});
		
	};
})(jQuery);
