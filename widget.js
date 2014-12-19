WAF.define('ComboBox', ['waf-core/widget', 'TextInput', 'Button', 'wListView'], function(widget, TextInput, Button, wListView) {
    "use strict";

    var ComboBox = widget.create('ComboBox', {
        tagName: 'div',
        value: widget.property(),
        synchronized: widget.property({ type: 'boolean', bindable: false }),
        //allowEmpty: widget.property({ type: 'boolean', bindable: false }),
        autoComplete: widget.property({ type: 'boolean', bindable: false, defaultValue: true }),
        searchCriteria: widget.property({
            type: 'enum',
            values: {
                'startWith': 'start with',
                'endWith': 'end with',
                'contain': 'contain',
                'equal': 'equal'
            },
            defaultValue: '',
            bindable: false
        }),
        placeholder: widget.property({ type: 'string', bindable: false }),
        items: widget.property({
            type: 'datasource',
            attributes: [{
                name: 'value'
            }, {
                name: 'display'
            }],
            pageSize: 40
        }),
        template: widget.property({
            type: 'template',
            templates: [
                {
                    name: '[Text]',
                    template: '<li role="option" val={{value}}>\
                                            {{text}}\
                              </li>'
                },
                {
                    name: '[Image] [Text]',
                    template: '<li role="option" val={{value}}>\
                                            <p style="text-align: right;">\
                                            <img  src="{{image}}" />\
                                            {{text}}\
                                            </p>\
                              </li>'
                }

            ],
            datasourceProperty: 'items'
        }),
        render: function() { },
        init: function() {
            this._initInput();
            this._initButton();
            this._initList();
            this._changeCssClassName();

            var bound = this.value.boundDatasource();
            var boundDatasource = this.items.boundDatasource();
            var collection = this.getPart('list').collection();

            // synchronize source and duplicated datasource
            if(this.synchronized() && collection && boundDatasource) {
                this._synchronize2DS(collection, boundDatasource.datasource);
            }

            // update selected after bind value change
            if(! this.synchronized() && bound && bound.datasource && boundDatasource) {
                this._boundDsElementChangeSubscriber = bound.datasource.subscribe('currentElementChange', function(e) {
                    this._setSelectCbxFromBoundValue();
                }.bind(this));
            }
        },
        _changeCssClassName: function() {
            $(this.node).removeClass('waf-combobox').addClass('waf-combobox2');

           ['input', 'button', 'list'].forEach(function(name) {
                var widget = this.getPart(name);
                if(widget) {
                    $(widget.node).addClass('waf-combobox2-part-' + name);//.removeClass('waf-combobox-part-' + name);
                }
            }.bind(this));
        },
        _synchronize2DS: function(ds1, ds2) {
            var arrDs = [ds1, ds2];
            arrDs.forEach(function(currentDs, i) {
                this['_sync' + currentDs.datasourceName + 'Subscriber'] = currentDs.subscribe('currentElementChange', function(e) {
                        var secondDs = arrDs[(i+1)%2];
                        if(! currentDs.length || ! secondDs.length || currentDs.getKey() === secondDs.getKey())
                            return;
                        this['_sync' + secondDs.datasourceName + 'Subscriber'].pause();
                        var options = {
                            onSuccess: function() {
                                this['_sync' + secondDs.datasourceName + 'Subscriber'].resume();
                            }.bind(this),
                            onError: function() {
                                this['_sync' + secondDs.datasourceName + 'Subscriber'].resume();
                            }.bind(this)
                        };
                        secondDs.selectByKey(currentDs.ID,  options);
                }.bind(this));
            }.bind(this));
        },
        selectElement: function(value) {
            this._selectValueCombobox(value, function() { this._setBindValue(); }.bind(this));
            this._closeList();
        },
        _getItemsMapping: function() {
            var mapping = {};
            var boundDatasource = this.items.boundDatasource();

            if(this.items.mapping()) {
                mapping = this.items.mapping();

            } else if(boundDatasource && ! boundDatasource.datasourceName
                      && boundDatasource.datasource._private.sourceType === 'array') {
                // in this case, the datasource is from static value cbx form configuration
                boundDatasource.datasource.getAttributeNames().forEach(function(att) { mapping[att] = att; });
            }

            return mapping;
        },
        _doSearch: function(value) {
            var collection = this.getPart('list').collection();
            var boundDatasource = this.items.boundDatasource();

            // search attribute
            var mapping = this._getItemsMapping();
            var searchAttribute = mapping.display;

            if(! collection || ! searchAttribute) {
                return;
            }
            // query datasource
            var queryString = '';
            if(value) {
                queryString = searchAttribute + ' = :1';
                switch(this.searchCriteria()) {
                    case 'startWith':
                        value += '*';
                        break;
                    case 'endWith':
                        value = '*' + value;
                        break;
                    case 'contain':
                        value = '*' + value + '*';
                        break;
                    case 'equal':
                        break;
                    default:
                        value += '*';
                }
            }

            this._pauseDupDs(true);
            collection.query(queryString, {
                onSuccess: function(e) {
                    this._openList();
                    this._pauseDupDs(false);
                }.bind(this),
                params: [ value ]
            });
        },
        _initButton: function() {
            var button = this.getPart('button');
            button.show();

            $(button.node).on('click', function(e) {
                if(this._isListOpen())
                    this._closeList();
                else
                    this._doSearch();
            }.bind(this));
        },
        _initInput: function() {
            var input = this.getPart('input');
            input.show();

            // autocomplete
            $(input.node).attr('readonly', ! this.autoComplete());

            // placeholder
            $(input.node).attr('placeholder', this.placeholder());

            $(input.node).on('keyup', function(e) {
                var value = input.node.value;
                this._doSearch(value);
            }.bind(this));
        },
        _initList: function() {
            var list = this.getPart('list');

            function _initListDataSource() {
                var bound = this.value.boundDatasource();
                var boundDatasource = this.items.boundDatasource();

                if(boundDatasource) {
                    var duplicateDs = this._duplicateDataSource(boundDatasource);
                    var mapping = this._getItemsMapping();
                    list.collection(duplicateDs);

                    this._dupDsElementChangeSubscriber = duplicateDs.subscribe('currentElementChange', function() {
                        var value = duplicateDs.getAttributeValue(mapping.value);
                        this.selectElement(value);
                    }.bind(this));

                    this._dupDsCollectionChangeSubscriber = duplicateDs.subscribe('collectionChange', function() {
                        if(! this.synchronized() && bound) {
                            this._setSelectCbxFromBoundValue();
                        }
                    }.bind(this));
                } else {
                    list.collection(null);
                }
            };

            var bound = this.value.boundDatasource();

            // at execution, bind datasource to list
            if(this.items()) {
                _initListDataSource.call(this);
                list.template(this.template());
                if(this.items.mapping()) {
                    list.collection.setMapping(this.items.mapping());
                }
            }

            // hide list when clicking outside combobox
            $(document).on('click', function(e) {
                if (this._isListOpen() && ! $(e.target).closest(this.node).length) {
                    this._closeList();
                    // rest to the default value
                    if(! this.synchronized() && bound && bound.datasource) {
                        this._setSelectCbxFromBoundValue();
                    } else {
                        list.collection().query();
                    }
                }
            }.bind(this));

            $(list.node).on('click', function(e) {
                var value = $(e.target).closest('li').attr('val');
                this.selectElement(value);
                this._closeList();
            }.bind(this));
        },
        // executed only in the change of the combobox selected value
        _setBindValue: function() {
            var bound = this.value.boundDatasource();
            var collection = this.getPart('list').collection();
            var mapping = this._getItemsMapping();
            if(this.synchronized() || ! bound) return;

            this._boundDsElementChangeSubscriber.pause();

            var boundAttribute = bound.datasource.getAttribute(bound.attribute);
            if(boundAttribute.kind === 'relatedEntity') {
                bound.datasource[bound.attribute].set(collection);
            } else {
                bound.datasource.setAttributeValue(bound.attribute, collection.getAttributeValue(mapping.value));
            }

            this._boundDsElementChangeSubscriber.resume();
        },
        _pauseDupDs: function(bool) {
            if(bool) {
                this._dupDsElementChangeSubscriber.pause();
                this._dupDsCollectionChangeSubscriber.pause();
            } else {
                this._dupDsElementChangeSubscriber.resume();
                this._dupDsCollectionChangeSubscriber.resume();
            }
        },
        // executed only when bind value change
        _setSelectCbxFromBoundValue: function() {
            var bound = this.value.boundDatasource();
            if(! bound) return;
            var value = bound.datasource.getAttributeValue(bound.attribute);
            this._dupDsElementChangeSubscriber.pause();
            this._selectValueCombobox(value, function() { this._dupDsElementChangeSubscriber.resume(); }.bind(this));
        },
        _closeList: function() {
            this.getPart('list').hide();
        },
        _openList: function() {
            this.getPart('list').show();
        },
        _isListOpen: function() {
            return $(this.getPart('list').node).is(':visible');
        },
        _selectValueCombobox: function(value, callback) {
            var collection = this.getListDatasource();
            var mapping = this._getItemsMapping();
            if(! collection) {
                return;
            }
            var filterQuery = mapping.value + '="' + value + '"';
            // re init the datsource 
            // because toArray method work only on the current set
            this._pauseDupDs(true);
            var that = this;
            collection.query('', {
                onSuccess: function() {
                    collection.toArray([], {
                        filterQuery: filterQuery,
                        retainPositions: true,
                        onSuccess: function(e) {
                            console.info('> filterQuery : ', filterQuery);
                            var position = e.result.length ? e.result[0].__POSITION : undefined;
                            var length = e.result.length;
                            var options = {
                                onSuccess: function(evt) {
                                    if(callback) callback.call(that);
                                    that.getPart('input').value(collection.getAttributeValue(mapping.display));

                                    if(length === 0)
                                        that.fire('notFound')
                                    else if(length > 1)
                                        that.fire('doublonFound');
                                    else
                                        that.fire('changed');

                                    that._pauseDupDs(false);
                                },
                                onError: function(evt) {
                                    if(callback) callback.call(that);
                                    that._pauseDupDs(false);
                                }
                            };
                            collection.select(position, options);

                        },
                        onError: function(e) {
                            if(callback) callback.call(that);
                        }
                    });
                },
                onError: function(e) {
                    that._pauseDupDs(false);
                }
            });
        },
        getListDatasource: function() {
            return this.getPart('list').collection();
        },
        _duplicateDataSource: function(oldDs) {
            if(! oldDs) return;
            var dsName = oldDs.datasourceName || 'private';
            var newDsParams = {
                'id': this.id + '_' + dsName,
                'binding': oldDs.datasource._private.initialBinding,
                'data-initialQueryString': oldDs.datasource._private.initialQueryStr,
                'data-source-type': oldDs.datasource._private.sourceType,
                'data-initialOrderBy': oldDs.datasource._private.initialOrderBy
            };
            // generate new ds name
            //var regx = new RegExp('^' + newDsParams.id + '(\\d+)$');
            //newDsParams.id += Math.max.apply(Math, Object.keys(sources).map(function(elem) {
            //            return parseInt((regx.exec(elem) || [])[1] || 0, 10); })) + 1;

            function _tmptoArray(arr, attributes, options) {
                var arrRef = this._private._getFullSet();
                if(! (attributes instanceof Array)) {
                    options = attributes;
                }
                var filters = options.filterQuery.split('=');
                var attribute, value;
                if(filters.length == 2) {
                    attribute = filters[0].trim();
                    value = filters[1].trim();
                    value = value.replace(/^('(.*)')|("(.*)")$/, "$2$4");
                } else {
                    if(options.onError) options.onError.call();
                }

                for(var i=0; i < this.length; i++) {
                    if(arrRef[i][attribute] == value) {
                        var elm = WAF.clone(arrRef[i]);
                        elm.__POSITION = i;
                        arr.push(elm);
                    }
                }
                if(options.onSuccess) {
                    options.onSuccess({ result: arr });
                }
            };

            var newDs;
            switch(newDsParams['data-source-type']) {
                case 'relatedEntities':
                case 'dataClass':
                    newDs = WAF.dataSource.create(newDsParams);
                    if(newDs.query) newDs.query();
                    break;
                case 'array':
                    window[newDsParams.id] = WAF.clone(oldDs.datasource._private.varRef);
                    newDsParams.binding = newDsParams.id;
                    var dataAttributes = oldDs.datasource.getAttributeNames().map(function(att) { return att + ':string'; });
                    newDsParams['data-attributes'] = dataAttributes.join(',');
                    newDs = WAF.dataSource.create(newDsParams);
                    newDs.toArray = _tmptoArray.bind(newDs);
                    newDs.sync();
                    break;
                case 'scalar':
                case 'object':
                case 'relatedEntity':
                default:
                    throw("not implemented duplicated datasource type : " + newDsParams['data-source-type']);
                    break;
            }

            return newDs;
        }
    });

    ComboBox.inherit('waf-behavior/layout/composed');
    ComboBox.setPart('input', TextInput);
    ComboBox.setPart('button', Button);
    ComboBox.setPart('list', wListView);

    return ComboBox;
});
