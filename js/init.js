/*
	Tessellate 1.0 by HTML5 UP
	html5up.net | @n33co
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

/*********************************************************************************/
/* Settings                                                                      */
/*********************************************************************************/

	var _settings = {

		// skelJS
			skelJS: {
				prefix: 'css/style',
				resetCSS: true,
				boxModel: 'border',
				containers: 1200,
				useOrientation: true,
				breakpoints: {
					'widest': { range: '*', containers: 1360, grid: { gutters: 50 }, hasStyleSheet: false },
					'wide': { range: '-1680', containers: 1200, grid: { gutters: 40 } },
					'normal': { range: '-1280', containers: 960, grid: { gutters: 30 }, lockViewport: true },
					'narrow': { range: '-1000', containers: '100%', grid: { gutters: 25, collapse: true }, lockViewport: true },
					'mobile': { range: '-640', containers: '100%', grid: { gutters: 10, collapse: true }, lockViewport: true }
				}
			}

	};

/*********************************************************************************/
/* jQuery Plugins                                                                */
/*********************************************************************************/

	// formerize
		jQuery.fn.n33_formerize=function(){var _fakes=new Array(),_form = jQuery(this);_form.find('input[type=text],textarea').each(function() { var e = jQuery(this); if (e.val() == '' || e.val() == e.attr('placeholder')) { e.addClass('formerize-placeholder'); e.val(e.attr('placeholder')); } }).blur(function() { var e = jQuery(this); if (e.attr('name').match(/_fakeformerizefield$/)) return; if (e.val() == '') { e.addClass('formerize-placeholder'); e.val(e.attr('placeholder')); } }).focus(function() { var e = jQuery(this); if (e.attr('name').match(/_fakeformerizefield$/)) return; if (e.val() == e.attr('placeholder')) { e.removeClass('formerize-placeholder'); e.val(''); } }); _form.find('input[type=password]').each(function() { var e = jQuery(this); var x = jQuery(jQuery('<div>').append(e.clone()).remove().html().replace(/type="password"/i, 'type="text"').replace(/type=password/i, 'type=text')); if (e.attr('id') != '') x.attr('id', e.attr('id') + '_fakeformerizefield'); if (e.attr('name') != '') x.attr('name', e.attr('name') + '_fakeformerizefield'); x.addClass('formerize-placeholder').val(x.attr('placeholder')).insertAfter(e); if (e.val() == '') e.hide(); else x.hide(); e.blur(function(event) { event.preventDefault(); var e = jQuery(this); var x = e.parent().find('input[name=' + e.attr('name') + '_fakeformerizefield]'); if (e.val() == '') { e.hide(); x.show(); } }); x.focus(function(event) { event.preventDefault(); var x = jQuery(this); var e = x.parent().find('input[name=' + x.attr('name').replace('_fakeformerizefield', '') + ']'); x.hide(); e.show().focus(); }); x.keypress(function(event) { event.preventDefault(); x.val(''); }); });  _form.submit(function() { jQuery(this).find('input[type=text],input[type=password],textarea').each(function(event) { var e = jQuery(this); if (e.attr('name').match(/_fakeformerizefield$/)) e.attr('name', ''); if (e.val() == e.attr('placeholder')) { e.removeClass('formerize-placeholder'); e.val(''); } }); }).bind("reset", function(event) { event.preventDefault(); jQuery(this).find('select').val(jQuery('option:first').val()); jQuery(this).find('input,textarea').each(function() { var e = jQuery(this); var x; e.removeClass('formerize-placeholder'); switch (this.type) { case 'submit': case 'reset': break; case 'password': e.val(e.attr('defaultValue')); x = e.parent().find('input[name=' + e.attr('name') + '_fakeformerizefield]'); if (e.val() == '') { e.hide(); x.show(); } else { e.show(); x.hide(); } break; case 'checkbox': case 'radio': e.attr('checked', e.attr('defaultValue')); break; case 'text': case 'textarea': e.val(e.attr('defaultValue')); if (e.val() == '') { e.addClass('formerize-placeholder'); e.val(e.attr('placeholder')); } break; default: e.val(e.attr('defaultValue')); break; } }); window.setTimeout(function() { for (x in _fakes) _fakes[x].trigger('formerize_sync'); }, 10); }); return _form; };

	// scrolly
		jQuery.fn.n33_scrolly = function(offset) {				
			
			jQuery(this).click(function(e) {
				var h = jQuery(this).attr('href'), target;

				if (h.charAt(0) == '#' && h.length > 1 && (target = jQuery(h)).length > 0)
				{
					var pos = Math.max(target.offset().top, 0);
					e.preventDefault();
					
					if (offset)
					{
						if (typeof(offset) == 'function')
							pos -= (offset)();
						else
							pos -= offset;
					}
					
					jQuery('body,html').animate({ scrollTop: pos }, 1000, 'swing');
				}
			});
		};

/*********************************************************************************/
/* Initialize                                                                    */
/*********************************************************************************/

	// skelJS
		skel.init(_settings.skelJS);

	// jQuery
		jQuery(function() {

			var $window = $(window);

			// Scrolly links
				$('.scrolly').n33_scrolly();

			// Forms
				if (skel.vars.IEVersion < 10)
					$('form').n33_formerize();

		});
