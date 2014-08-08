jQuery.fn.hasScrollBar = function() {
    if (!$.contains(document, this.get(0))) {
        return false;
    }
    if(this.parent().height() < this.get(0).scrollHeight) {
        return true;
    }
    return false;
};

