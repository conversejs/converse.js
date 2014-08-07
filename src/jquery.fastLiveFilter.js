jQuery.fn.hasScrollBar = function() {
    var el = this.get(0);
    if(el.offsetHeight < el.scrollHeight) {
        return true;
    }
    else{
        return false;
    }
};

jQuery.fn.liveFilter = function(list, options) {
    /**
    * fastLiveFilter jQuery plugin 1.0.3
    * 
    * Copyright (c) 2011, Anthony Bush
    * License: <http://www.opensource.org/licenses/bsd-license.php>
    * Project Website: http://anthonybush.com/projects/jquery_fast_live_filter/
    **/
	// Options: input, list, timeout, callback
	options = options || {};
	var input = this;
	var lastFilter = '';
	var timeout = options.timeout || 0;
	var callback = options.callback || function() {};
	var keyTimeout;
	callback(); // do a one-time callback on initialization to make sure everything's in sync
	
	input.change(function() {
        var $list = jQuery(list);
        var lis = $list.children();
        var len = lis.length;
		var filter = input.val().toLowerCase();
        if (filter.length > 0) {
            $list.find(options.hide).hide();
        } else {
            // TODO: remember original state and set back to that
            $list.find(options.hide).show();
        }
		var li, innerText;
		var numShown = 0;
		for (var i = 0; i < len; i++) {
			li = lis[i];
			innerText = !options.selector ? 
				(li.textContent || li.innerText || "") : 
				$(li).find(options.selector).text();
			
			if (innerText.toLowerCase().indexOf(filter) >= 0) {
				if (li.style.display == "none") {
                    $(li).show();
				}
				numShown++;
			} else {
				if (li.style.display != "none") {
                    $(li).hide();
				}
			}
		}
		callback(numShown);
		return false;
	}).keydown(function() {
		clearTimeout(keyTimeout);
		keyTimeout = setTimeout(function() {
			if( input.val() === lastFilter ) return;
			lastFilter = input.val();
			input.change();
		}, timeout);
	});
	return this; // maintain jQuery chainability
};
