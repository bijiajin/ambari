/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var App = require('app');

var validator = require('utils/validator');
require('utils/configs/modification_handlers/modification_handler');

App.ServiceConfigsByCategoryView = Em.View.extend(App.UserPref, App.ConfigOverridable, {

  templateName: require('templates/common/configs/service_config_category'),

  classNames: ['accordion-group', 'common-config-category'],

  classNameBindings: ['category.name', 'isShowBlock::hidden'],

  content: null,

  category: null,

  service: null,

  /**
   * View is editable or read-only?
   * @type {boolean}
   */
  canEdit: true,

  /**
   * All configs for current <code>service</code>
   * @type {App.ServiceConfigProperty[]}
   */
  serviceConfigs: null,

  /**
   * Configs for current category filtered by <code>isVisible</code>
   * and sorted by <code>displayType</code> and <code>index</code>
   * @type {App.ServiceConfigProperty[]}
   */
  categoryConfigs: [],

  /**
   * This is array of all the properties which apply
   * to this category, irrespective of visibility. This
   * is helpful in Oozie/Hive database configuration, where
   * MySQL etc. database options don't show up, because
   * they were not visible initially.
   * @type {App.ServiceConfigProperty[]}
   */
  categoryConfigsAll: [],

  didInsertElement: function () {
    var self = this;
    this.setCategoryConfigs();
    this.setVisibleCategoryConfigs();
    var isCollapsed = this.calcIsCollapsed();
    this.set('category.isCollapsed', isCollapsed);
    if (isCollapsed) {
      this.$('.accordion-body').hide();
    }
    else {
      this.$('.accordion-body').show();
    }
    $('#serviceConfig').tooltip({
      selector: '[data-toggle=tooltip]',
      placement: 'top'
    });
    this.filteredCategoryConfigs();
    Em.run.next(function () {
      self.updateReadOnlyFlags();
    });
  },

  willDestroyElement: function () {
    $('[data-toggle=tooltip]').tooltip('destroy');
  },

  setVisibleCategoryConfigsOnce: function () {
    Em.run.once(this, 'addConfigToCategoryConfigs');
  }.observes('categoryConfigsAll.@each.isVisible'),

  setCategoryConfigs: function () {
    var categoryConfigsAll = this.get('serviceConfigs').filterProperty('category', this.get('category.name'));
    if (categoryConfigsAll && categoryConfigsAll.length) {
      this.set('categoryConfigsAll',categoryConfigsAll);
    }
  },

  setVisibleCategoryConfigs: function () {
    var orderedCategoryConfigs = this.getOrderedCategoryConfigs();
    this.set('categoryConfigs', orderedCategoryConfigs);
  },

  /**
   * This method is invoked when any change in visibility of items of `categoryConfigsAll` array happens and accordingly sets `categoryConfigs` array
   * Instead of completely resetting `categoryConfigs` array whenever this function is invoked , items are added/removed in `categoryConfigs` (which is binded in template)
   * Doing so is observed to avoid memory leak
   */
  addConfigToCategoryConfigs: function () {
    var orderedCategoryConfigs = this.getOrderedCategoryConfigs();
    var categoryConfigs = this.get('categoryConfigs');
    var configsToAdd = [];
    var configsToRemove = [];
    // If property is added or made visible then add it to visible categoryconfigs
    orderedCategoryConfigs.forEach(function(item){
      var isPresent = categoryConfigs.filterProperty('name', item.get('name')).findProperty('filename',item.get('filename'));
      if (!isPresent) {
        configsToAdd.pushObject(item);
      }
    }, this);

    // If property is removed or made invisible, then remove it from visible categoryconfigs
    categoryConfigs.forEach(function(item){
      var orderedCategoryConfig = orderedCategoryConfigs.filterProperty('name', item.get('name')).findProperty('filename',item.get('filename'));
      if (!orderedCategoryConfig) {
        configsToRemove.pushObject(item);
      }
    }, this);

    categoryConfigs.pushObjects(configsToAdd);
    categoryConfigs.removeObjects(configsToRemove);
  },

  getOrderedCategoryConfigs: function() {
    var categoryConfigsAll = this.get('categoryConfigsAll');
    var orderedCategoryConfigs = [];
    if (categoryConfigsAll) {
      var contentOrderedArray = this.orderContentAtLast(categoryConfigsAll.filterProperty('displayType','content')),
        contentFreeConfigs = categoryConfigsAll.filter(function(config) {return config.get('displayType')!=='content';}),
        indexOrdered = this.sortByIndex(contentFreeConfigs);
      orderedCategoryConfigs = indexOrdered.concat(contentOrderedArray).filterProperty('isVisible', true);
    }
    return orderedCategoryConfigs;
  },


  /**
   * If added/removed a serverConfigObject, this property got updated.
   * Without this property, all serviceConfigs Objects will show up even if some was collapsed before.
   * @type {boolean}
   */
  isCategoryBodyVisible: Em.computed.ifThenElse('category.isCollapsed', 'display: none;', 'display: block;'),

  /**
   * Should we show config group or not
   * @type {boolean}
   */
  isShowBlock: function () {
    var isCustomPropertiesCategory = this.get('category.customCanAddProperty');
    var hasFilteredAdvancedConfigs = this.get('categoryConfigs').filter(function (config) {
        return config.get('isHiddenByFilter') === false && Em.isNone(config.get('widget'));
      }, this).length > 0;
    return (isCustomPropertiesCategory && this.get('controller.filter') === '' && !this.get('parentView.columns').someProperty('selected')) ||
      hasFilteredAdvancedConfigs;
  }.property('category.customCanAddProperty', 'categoryConfigs.@each.isHiddenByFilter', 'categoryConfigs.@each.widget', 'controller.filter', 'parentView.columns.@each.selected'),

  /**
   * Re-order the configs to list content displayType properties at last in the category
   * @param {App.ServiceConfigProperty[]} categoryConfigs
   * @method orderContentAtLast
   */
  orderContentAtLast: function (categoryConfigs) {
    var contentProperties = categoryConfigs.filterProperty('displayType', 'content');
    if (!contentProperties.length) {
      return categoryConfigs;
    }
    else {
      return categoryConfigs.sort(function (a, b) {
        var aContent = contentProperties.someProperty('name', a.get('name'));
        var bContent = contentProperties.someProperty('name', b.get('name'));
        if (aContent && bContent) {
          return 0;
        }
        return aContent ? 1 : -1;
      });
    }
  },

  /**
   * Warn/prompt user to adjust Service props when changing user/groups in Misc
   * Is triggered when user ended editing text field
   */
  configChangeObserver: function (manuallyChangedProperty) {
    var changedProperty;
    if (manuallyChangedProperty.get("id")) {
      changedProperty = [manuallyChangedProperty];
    }
    else {
      changedProperty = this.get("serviceConfigs").filterProperty("editDone", true);
    }

    if (changedProperty.length > 0) {
      changedProperty = changedProperty.objectAt(0);
    }
    else {
      return;
    }
    this.affectedProperties = [];
    var stepConfigs = this.get("controller.stepConfigs");
    var serviceId = this.get('controller.selectedService.serviceName');
    var serviceConfigModificationHandler = null;
    try{
      serviceConfigModificationHandler = require('utils/configs/modification_handlers/'+serviceId.toLowerCase());
    }catch (e) {
      console.log("Unable to load modification handler for ", serviceId);
    }
    if (serviceConfigModificationHandler != null) {
      var securityEnabled = App.router.get('mainAdminKerberosController.securityEnabled');
      this.affectedProperties = serviceConfigModificationHandler.getDependentConfigChanges(changedProperty, this.get("controller.selectedServiceNames"), stepConfigs, securityEnabled);
    }
    changedProperty.set("editDone", false); // Turn off flag

    if (this.affectedProperties.length > 0 && !this.get("controller.miscModalVisible")) {
      this.newAffectedProperties = this.affectedProperties;
      var self = this;
      return App.ModalPopup.show({
        classNames: ['modal-690px-width'],
        showCloseButton: false,
        header: "Warning: you must also change these Service properties",
        onApply: function () {
          self.get("newAffectedProperties").forEach(function(item) {
            if (item.isNewProperty) {
              self.createProperty({
                name: item.propertyName,
                displayName: item.propertyDisplayName,
                value: item.newValue,
                categoryName: item.categoryName,
                serviceName: item.serviceName,
                filename: item.filename
              });
            } else {
              self.get("controller.stepConfigs").findProperty("serviceName", item.serviceName).get("configs").find(function(config) {
                return item.propertyName == config.get('name') && (item.filename == null || item.filename == config.get('filename'));
              }).set("value", item.newValue);
            }
          });
          self.get("controller").set("miscModalVisible", false);
          this.hide();
        },
        onIgnore: function () {
          self.get("controller").set("miscModalVisible", false);
          this.hide();
        },
        onUndo: function () {
          var affected = self.get("newAffectedProperties").objectAt(0),
            changedProperty = self.get("controller.stepConfigs").findProperty("serviceName", affected.sourceServiceName)
              .get("configs").findProperty("name", affected.changedPropertyName);
          changedProperty.set('value', changedProperty.get('savedValue') || changedProperty.get('initialValue'));
          self.get("controller").set("miscModalVisible", false);
          this.hide();
        },
        footerClass: Em.View.extend({
          classNames: ['modal-footer'],
          templateName: require('templates/common/configs/propertyDependence_footer'),
          canIgnore: serviceId == 'MISC'
        }),
        bodyClass: Em.View.extend({
          templateName: require('templates/common/configs/propertyDependence'),
          controller: this,
          propertyChange: self.get("newAffectedProperties"),
          didInsertElement: function () {
            self.get("controller").set("miscModalVisible", true);
          }
        })
      });
    }
  }.observes('categoryConfigs.@each.editDone'),

  /**
   * When the view is in read-only mode, it marks
   * the properties as read-only.
   */
  updateReadOnlyFlags: function () {
    var configs = this.get('serviceConfigs');
    var canEdit = this.get('canEdit');
    if (!canEdit && configs) {
      configs.forEach(function (c) {
        c.set('isEditable', false);
        var overrides = c.get('overrides');
        if (overrides != null) {
          overrides.setEach('isEditable', false);
        }
      });
    }
  },

  /**
   * Filtered <code>categoryConfigs</code> array. Used to show filtered result
   * @method filteredCategoryConfigs
   */
  filteredCategoryConfigs: function () {
    Em.run.once(this, 'collapseCategory');
  }.observes('categoryConfigs.@each.isHiddenByFilter'),

  collapseCategory: function () {
    if (this.get('state') === 'destroyed') return;
    $('.popover').remove();
    var filter = this.get('parentView.filter').toLowerCase();
    var filteredResult = this.get('categoryConfigs');
    var isInitialRendering = !arguments.length || arguments[1] != 'categoryConfigs';

    filteredResult = filteredResult.filterProperty('isHiddenByFilter', false);
    filteredResult = this.sortByIndex(filteredResult);

    if (filter) {
      if (filteredResult.length && typeof this.get('category.collapsedByDefault') === 'undefined') {
        // Save state
        this.set('category.collapsedByDefault', this.get('category.isCollapsed'));
      }
      this.set('category.isCollapsed', !filteredResult.length);
    } else if (typeof this.get('category.collapsedByDefault') !== 'undefined') {
      // If user clear filter -- restore defaults
      this.set('category.isCollapsed', this.get('category.collapsedByDefault'));
      this.set('category.collapsedByDefault', undefined);
    } else if (isInitialRendering && !filteredResult.length) {
      this.set('category.isCollapsed', true);
    }
    var categoryBlock = $('.' + this.get('category.name').split(' ').join('.') + '>.accordion-body');
    this.get('category.isCollapsed') ? categoryBlock.hide() : categoryBlock.show();
  },

  /**
   * sort configs in current category by index
   * @param configs
   * @return {Array}
   * @method sortByIndex
   */
  sortByIndex: function (configs) {
    var sortedConfigs = [];
    var unSorted = [];
    if (!configs.someProperty('index')) {
      return configs;
    }
    configs.forEach(function (config) {
      var index = config.get('index');
      if ((index !== null) && isFinite(index)) {
        sortedConfigs[index] ? sortedConfigs.splice(index, 0, config) : sortedConfigs[index] = config;
      } else {
        unSorted.push(config);
      }
    });
    // remove undefined elements from array
    sortedConfigs = sortedConfigs.filter(function (config) {
      return config !== undefined;
    });
    return sortedConfigs.concat(unSorted);
  },

  /**
   * Onclick handler for Config Group Header. Used to show/hide block
   * @method onToggleBlock
   */
  onToggleBlock: function () {
    this.$('.accordion-body').toggle('blind', 500);
    this.toggleProperty('category.isCollapsed');
  },

  /**
   * Determines should accordion be collapsed by default
   * @returns {boolean}
   * @method calcIsCollapsed
   */
  calcIsCollapsed: function() {
    return Em.isNone(this.get('category.isCollapsed')) ? (this.get('category.name').indexOf('Advanced') != -1 || this.get('category.name').indexOf('CapacityScheduler') != -1 || this.get('category.name').indexOf('Custom') != -1) : this.get('category.isCollapsed');
  },

  /**
   * @returns {string}
   */
  persistKey: function () {
    return 'admin-bulk-add-properties-' + App.router.get('loginName');
  },

  isSecureConfig: function (configName, filename) {
    var secureConfigs = App.config.get('secureConfigs').filterProperty('filename', filename);
    return !!secureConfigs.findProperty('name', configName);
  },

  createProperty: function (propertyObj) {
    var config;
    var selectedConfigGroup = this.get('controller.selectedConfigGroup');
    if (selectedConfigGroup.get('isDefault')) {
      config = App.config.createDefaultConfig(propertyObj.name, propertyObj.filename, false, {
        value: propertyObj.value,
        propertyType: propertyObj.propertyType,
        category: propertyObj.categoryName,
        isNotSaved: true
      });
    } else {
      config = App.config.createCustomGroupConfig({
        propertyName: propertyObj.name,
        filename: propertyObj.filename,
        value: propertyObj.value,
        propertyType: propertyObj.propertyType,
        category: propertyObj.categoryName,
        isNotSaved: true
      }, selectedConfigGroup);
    }
    var serviceConfigProperty = App.ServiceConfigProperty.create(config);
    this.get('serviceConfigs').pushObject(serviceConfigProperty);
    this.get('categoryConfigsAll').pushObject(serviceConfigProperty);
  },

  /**
   * Find duplications within the same confType
   * Result in error, as no duplicated property keys are allowed in the same configType
   * */
  isDuplicatedConfigKey: function(name) {
    var category = this.get('category');
    var siteFileName = category.get('siteFileName');

    var service = this.get('service');
    var serviceName = service.get('serviceName');

    var configsOfFile = service.get('configs').filterProperty('filename', siteFileName);
    return configsOfFile.findProperty('name', name);
  },

  /**
   * find duplications in all confTypes of the service
   * Result in warning, to remind user the existence of a same-named property
   * */
  isDuplicatedConfigKeyinConfigs: function(name) {
    var files = [];
    var service = this.get('service');
    var configFiles = service.get('configs').mapProperty('filename').uniq();
    configFiles.forEach(function (configFile) {
      var configsOfFile = service.get('configs').filterProperty('filename', configFile);
      if (configsOfFile.findProperty('name', name)) {
        files.push(configFile);
      }
    }, this);
    return files;
  },

  processAddPropertyWindow: function(isBulkMode, modePersistKey) {
    var self = this;
    var category = this.get('category');
    var siteFileName = category.get('siteFileName');

    var service = this.get('service');
    var serviceName = service.get('serviceName');

    var serviceConfigObj = Em.Object.create({
      isBulkMode: isBulkMode,
      bulkConfigValue: '',
      bulkConfigError: false,
      bulkConfigErrorMessage: '',

      name: '',
      value: '',
      isKeyError: false,
      showFilterLink: false,
      errorMessage: '',
      observeAddPropertyValue: function () {
        var name = this.get('name');
        if (name.trim() != '') {
          if (validator.isValidConfigKey(name)) {
            if (!self.isDuplicatedConfigKey(name)) { //no duplication within the same confType
              var files = self.isDuplicatedConfigKeyinConfigs(name);
              if (files.length > 0) {
                //still check for a warning, if there are duplications across confTypes
                this.set('showFilterLink', true);
                this.set('isKeyWarning', true);
                this.set('isKeyError', false);
                this.set('warningMessage', Em.I18n.t('services.service.config.addPropertyWindow.error.derivedKey.location').format(files.join(" ")));
              } else {
                this.set('showFilterLink', false);
                this.set('isKeyError', false);
                this.set('isKeyWarning', false);
                this.set('errorMessage', '');
              }
            } else {
              this.set('showFilterLink', true);
              this.set('isKeyError', true);
              this.set('isKeyWarning', false);
              this.set('errorMessage', Em.I18n.t('services.service.config.addPropertyWindow.error.derivedKey.infile'));
            }
          } else {
            this.set('showFilterLink', false);
            this.set('isKeyError', true);
            this.set('isKeyWarning', false);
            this.set('errorMessage', Em.I18n.t('form.validator.configKey'));
          }
        } else {
          this.set('showFilterLink', false);
          this.set('isKeyError', true);
          this.set('isKeyWarning', false);
          this.set('errorMessage', Em.I18n.t('services.service.config.addPropertyWindow.error.required'));
        }
      }
    });

    App.ModalPopup.show({
      classNames: ['sixty-percent-width-modal'],
      header: Em.I18n.t('installer.step7.config.addProperty'),
      primary: Em.I18n.t('add'),
      secondary: Em.I18n.t('common.cancel'),
      onPrimary: function () {
        var propertyObj = {
          filename: siteFileName,
          serviceName: serviceName,
          categoryName: category.get('name')
        };
        if (serviceConfigObj.isBulkMode) {
          var popup = this;
          this.processConfig(serviceConfigObj.bulkConfigValue, function (error, parsedConfig) {
            if (error) {
              serviceConfigObj.set('bulkConfigError', true);
              serviceConfigObj.set('bulkConfigErrorMessage', error);
            } else {
              for (var key in parsedConfig) {
                if (parsedConfig.hasOwnProperty(key)) {
                  propertyObj.name = key;
                  propertyObj.value = parsedConfig[key];
                  self.createProperty(propertyObj);
                }
              }
              popup.hide();
            }
          });
        } else {
          serviceConfigObj.observeAddPropertyValue();
          /**
           * For the first entrance use this if (serviceConfigObj.name.trim() != '')
           */
          if (!serviceConfigObj.isKeyError) {
            propertyObj.name = serviceConfigObj.get('name');
            propertyObj.value = serviceConfigObj.get('value');
            self.createProperty(propertyObj);
            this.hide();
          }
        }
      },

      lineNumber: function(index) {
        return Em.I18n.t('services.service.config.addPropertyWindow.error.lineNumber').format(index + 1);
      },

      processConfig: function(config, callback) {
        var lines = config.split('\n');
        var errorMessages = [];
        var parsedConfig = {};
        var propertyCount = 0;
        lines.forEach(function (line, index) {
          if (line.trim() === '') {
            return;
          }
          var delimiter = '=';
          var delimiterPosition = line.indexOf(delimiter);
          if (delimiterPosition === -1) {
            errorMessages.push(this.lineNumber(index) + Em.I18n.t('services.service.config.addPropertyWindow.error.format'));
            return;
          }
          var key = Em.Handlebars.Utils.escapeExpression(line.slice(0, delimiterPosition).trim());
          var value = line.slice(delimiterPosition + 1);
          if (validator.isValidConfigKey(key)) {
            if (!self.isDuplicatedConfigKey(key) && !(key in parsedConfig)) {
              parsedConfig[key] = value;
              propertyCount++;
            } else {
              errorMessages.push(this.lineNumber(index) + Em.I18n.t('services.service.config.addPropertyWindow.error.derivedKey.specific').format(key));
            }
          } else {
            errorMessages.push(this.lineNumber(index) + Em.I18n.t('form.validator.configKey.specific').format(key));
          }
        });

        if (errorMessages.length > 0) {
          callback(errorMessages.join('<br>'), parsedConfig);
        }
        else if (propertyCount === 0) {
          callback(Em.I18n.t('services.service.config.addPropertyWindow.propertiesPlaceholder', parsedConfig));
        }
        else {
          callback(null, parsedConfig);
        }
      },
      willDestroyElement: function () {
        serviceConfigObj.destroy();
        this._super();
      },
      bodyClass: Em.View.extend({
        fileName: siteFileName,
        notMisc: serviceName !== 'MISC',
        templateName: require('templates/common/configs/addPropertyWindow'),
        serviceConfigObj: serviceConfigObj,
        didInsertElement: function () {
          this._super();
          serviceConfigObj.addObserver('name', serviceConfigObj, 'observeAddPropertyValue');
          App.tooltip(this.$("[data-toggle=tooltip]"), {
            placement: "top"
          });
        },
        willDestroyElement: function () {
          this.$().popover('destroy');
          serviceConfigObj.removeObserver('name', serviceConfigObj, 'observeAddPropertyValue');
          this.set('serviceConfigObj', null);
          this._super();
        },
        toggleBulkMode: function () {
          this.toggleProperty('serviceConfigObj.isBulkMode');
          self.postUserPref(modePersistKey, this.get('serviceConfigObj.isBulkMode'));
        },
        filterByKey: function (event) {
          var controller = (App.router.get('currentState.name') == 'configs')
            ? App.router.get('mainServiceInfoConfigsController')
            : App.router.get('wizardStep7Controller');
          this.get('parentView').onClose();
          controller.set('filter', event.view.get('serviceConfigObj.name'));
        }
      })
    });
  },

  /**
   * Show popup for adding new config-properties
   * @method showAddPropertyWindow
   */
  showAddPropertyWindow: function () {
    var persistController = this;
    var modePersistKey = this.persistKey();
    var selectedConfigGroup = this.get('controller.selectedConfigGroup');

    persistController.getUserPref(modePersistKey).then(function (data) {
      return !!data;
    },function () {
      return false;
    }).always((function (isBulkMode) {
      persistController.processAddPropertyWindow(isBulkMode, modePersistKey);
    }));
  },



  /**
   * Toggle <code>isFinal</code> for selected config-property if <code>isNotEditable</code> is false
   * @param {object} event
   * @method toggleFinalFlag
   */
  toggleFinalFlag: function (event) {
    var serviceConfigProperty = event.contexts[0];
    if (serviceConfigProperty.get('isNotEditable')) {
      return;
    }
    serviceConfigProperty.toggleProperty('isFinal');
    serviceConfigProperty = null;
  },

  /**
   * Removes the top-level property from list of properties.
   * Should be only called on user properties.
   * @method removeProperty
   */
  removeProperty: function (event) {
    var serviceConfigProperty = event.contexts[0];
    // push config's file name if this config was stored on server
    if (!serviceConfigProperty.get('isNotSaved')) {
      var modifiedFileNames = this.get('controller.modifiedFileNames'),
        wizardController = this.get('controller.wizardController'),
        filename = serviceConfigProperty.get('filename');
      if (modifiedFileNames && !modifiedFileNames.contains(filename)) {
        modifiedFileNames.push(serviceConfigProperty.get('filename'));
      } else if (wizardController) {
        var fileNamesToUpdate = wizardController.getDBProperty('fileNamesToUpdate') || [];
        if (!fileNamesToUpdate.contains(filename)) {
          fileNamesToUpdate.push(filename);
          wizardController.setDBProperty('fileNamesToUpdate', fileNamesToUpdate);
        }
      }
    }
    this.get('serviceConfigs').removeObject(serviceConfigProperty);
    this.get('categoryConfigsAll').removeObject(serviceConfigProperty);
    serviceConfigProperty = null;
    Em.$('body>.tooltip').remove(); //some tooltips get frozen when their owner's DOM element is removed
  },

  /**
   * Set config's value to recommended
   * @param event
   * @method setRecommendedValue
   */
  setRecommendedValue: function (event) {
    var serviceConfigProperty = event.contexts[0];
    serviceConfigProperty.set('value', serviceConfigProperty.get('recommendedValue'));
    serviceConfigProperty = null;
  },

  /**
   * Restores given property's value to be its default value.
   * Does not update if there is no default value.
   * @method doRestoreDefaultValue
   */
  doRestoreDefaultValue: function (event) {
    var serviceConfigProperty = event.contexts[0];
    var value = serviceConfigProperty.get('value');
    var savedValue = serviceConfigProperty.get('savedValue');
    var supportsFinal = serviceConfigProperty.get('supportsFinal');
    var savedIsFinal = serviceConfigProperty.get('savedIsFinal');

    if (savedValue != null) {
      if (serviceConfigProperty.get('displayType') === 'password') {
        serviceConfigProperty.set('retypedPassword', savedValue);
      }
      serviceConfigProperty.set('value', savedValue);
    }
    if (supportsFinal) {
      serviceConfigProperty.set('isFinal', savedIsFinal);
    }
    this.configChangeObserver(serviceConfigProperty);
    serviceConfigProperty = null;
    Em.$('body>.tooltip').remove(); //some tooltips get frozen when their owner's DOM element is removed
  }

});
