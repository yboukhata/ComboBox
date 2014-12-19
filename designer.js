(function(ComboBox) {
    "use strict";

    ComboBox.setWidth('200');
    ComboBox.setHeight('25');

    ComboBox.addLabel();

    ComboBox.customizeProperty('synchronized', {
        title: 'Synchronized',
        description: 'Synchronized with Choices'
    });
    //ComboBox.customizeProperty('allowEmpty', {
    //    title: 'Add Empty Entry'
    //});
    ComboBox.customizeProperty('autoComplete', {
        title: 'Auto Complete'
    });
    ComboBox.customizeProperty('searchCriteria', {
        title: 'Search Criteria'
    });

    ComboBox.doAfter('init', function() {

        // synchrinized
        this.synchronized.onChange(function() {
            if(this.synchronized()) {
                this.value.hide();
                this.value.old = this.value();
                this.value(null);
            } else {
                this.value.show();
                this.value(this.value.old);
            }
        }.bind(this));

        // autocomplete
        this.autoComplete.onChange(function() {
            if(this.autoComplete()) {
                this.searchCriteria.show();
                this.searchCriteria(this.searchCriteria.old);
            } else {
                this.searchCriteria.hide();
                this.searchCriteria.old = this.searchCriteria();
                this.searchCriteria(null);
            }
        }.bind(this));

        // hide custom widgets parts configuration
        _hideAttributesForm.call(this);

        function _hideAttributesForm() {
            var input = this.getPart('input');
            var button = this.getPart('button');

            // hide TextInput configuration
            ['value', 'inputType', 'maxLength', 'placeholder', 'readOnly'].forEach(function(attribute) {
                input[attribute].hide();
            });

            // hide Button configuration
            ['plainText', 'title', 'url', 'actionSource'].forEach(function(attribute) {
                button[attribute].hide();
            });
        }
    });
});
