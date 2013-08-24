/* Load this script using conditional IE comments if you need to support IE 7 and IE 6. */

window.onload = function() {
	function addIcon(el, entity) {
		var html = el.innerHTML;
		el.innerHTML = '<span style="font-family: \'Converse-js\'">' + entity + '</span>' + html;
	}
	var icons = {
			'icon-home' : '&#xe000;',
			'icon-pencil' : '&#x270e;',
			'icon-camera' : '&#xe003;',
			'icon-camera-2' : '&#x2616;',
			'icon-play' : '&#x25d9;',
			'icon-music' : '&#x266b;',
			'icon-headphones' : '&#x266c;',
			'icon-phone' : '&#x260f;',
			'icon-phone-hang-up' : '&#x260e;',
			'icon-address-book' : '&#x270f;',
			'icon-notebook' : '&#x2710;',
			'icon-envelop' : '&#x2709;',
			'icon-pushpin' : '&#xe012;',
			'icon-bubble' : '&#x25fc;',
			'icon-bubble-2' : '&#x25fb;',
			'icon-bubbles' : '&#xe015;',
			'icon-bubbles-2' : '&#xe016;',
			'icon-bubbles-3' : '&#xe017;',
			'icon-user' : '&#xe01a;',
			'icon-users' : '&#xe01b;',
			'icon-quotes-left' : '&#xe01d;',
			'icon-spinner' : '&#x231b;',
			'icon-search' : '&#xe021;',
			'icon-cogs' : '&#xe022;',
			'icon-wrench' : '&#xe024;',
			'icon-unlocked' : '&#xe025;',
			'icon-lock' : '&#xe026;',
			'icon-lock-2' : '&#xe027;',
			'icon-key' : '&#xe028;',
			'icon-key-2' : '&#xe029;',
			'icon-zoom-out' : '&#xe02a;',
			'icon-zoom-in' : '&#xe02b;',
			'icon-cog' : '&#xe02f;',
			'icon-remove' : '&#xe02d;',
			'icon-remove-2' : '&#xe02e;',
			'icon-eye' : '&#xe030;',
			'icon-eye-blocked' : '&#xe031;',
			'icon-attachment' : '&#xe032;',
			'icon-globe' : '&#xe033;',
			'icon-heart' : '&#x2764;',
			'icon-happy' : '&#x263b;',
			'icon-thumbs-up' : '&#x261d;',
			'icon-smiley' : '&#x263a;',
			'icon-tongue' : '&#xe038;',
			'icon-sad' : '&#x2639;',
			'icon-wink' : '&#xe03a;',
			'icon-wondering' : '&#x2369;',
			'icon-confused' : '&#x2368;',
			'icon-shocked' : '&#x2364;',
			'icon-evil' : '&#x261f;',
			'icon-angry' : '&#xe03f;',
			'icon-cool' : '&#xe040;',
			'icon-grin' : '&#xe041;',
			'icon-info' : '&#x2360;',
			'icon-notification' : '&#xe01f;',
			'icon-warning' : '&#x26a0;',
			'icon-spell-check' : '&#xe045;',
			'icon-volume-high' : '&#xe046;',
			'icon-volume-medium' : '&#xe047;',
			'icon-volume-low' : '&#xe048;',
			'icon-volume-mute' : '&#xe049;',
			'icon-volume-mute-2' : '&#xe04a;',
			'icon-volume-decrease' : '&#xe04b;',
			'icon-volume-increase' : '&#xe04c;',
			'icon-bold' : '&#xe04d;',
			'icon-underline' : '&#xe04e;',
			'icon-italic' : '&#xe04f;',
			'icon-strikethrough' : '&#xe050;',
			'icon-new-tab' : '&#xe053;',
			'icon-youtube' : '&#xe055;',
			'icon-close' : '&#x2715;',
			'icon-blocked' : '&#x2718;',
			'icon-cancel-circle' : '&#xe058;',
			'icon-minus' : '&#xe05a;',
			'icon-plus' : '&#x271a;',
			'icon-checkbox-checked' : '&#x2611;',
			'icon-checkbox-unchecked' : '&#x2b27;',
			'icon-checkbox-partial' : '&#x2b28;',
			'icon-radio-checked' : '&#x2b26;',
			'icon-radio-unchecked' : '&#x2b25;',
			'icon-info-2' : '&#xe059;',
			'icon-newspaper' : '&#xe001;',
			'icon-image' : '&#x2b14;',
			'icon-offline' : '&#xe002;',
			'icon-busy' : '&#xe004;'
		},
		els = document.getElementsByTagName('*'),
		i, attr, html, c, el;
	for (i = 0; ; i += 1) {
		el = els[i];
		if(!el) {
			break;
		}
		attr = el.getAttribute('data-icon');
		if (attr) {
			addIcon(el, attr);
		}
		c = el.className;
		c = c.match(/icon-[^\s'"]+/);
		if (c && icons[c[0]]) {
			addIcon(el, icons[c[0]]);
		}
	}
};