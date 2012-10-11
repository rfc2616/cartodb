/**
 * map tab shown in cartodb admin
 */

cdb.admin.MapTab = cdb.core.View.extend({

  events: {
    'click .share a': 'shareMap'
  },

  className: 'map',

  initialize: function() {
    this.map = this.model;
    this.map_enabled = false;
    this.featureHovered = null;
    this.infowindowModel = this.options.infowindow;

    //this.add_related_model(this.options.dataLayer);
    this.add_related_model(this.map);
    this.add_related_model(this.options.table);
    this.add_related_model(this.infowindowModel);

    var self = this;

    cdb.god.bind("hidePanel", function(ev) {
      self._moveShareButton("hide");
    });
    cdb.god.bind("showPanel", function(ev) {
      self._moveShareButton("show");
    });

    this.map.bind('change:provider', this.switchMapType, this);

    _.bindAll(this, 'showNoGeoRefWarning');
  },

  clearMap: function() {
    this.mapView.clean();
    this.zoom.clean();
    this.infowindow.clean();
    this.baseLayerChooser.clean();

    delete this.mapView;
    delete this.zoom;
    delete this.infowindow;
    delete this.baseLayerChooser;

    this.map_enabled = false;
  },

  /**
   * this function is used when the map library is changed. Each map library
   * works in different way and need to recreate all the components again
   */
  switchMapType: function() {
    if(this.map_enabled) {
      this.clearMap();
      this.render();
      this.enableMap();
    }
  },


  /**
   * map can't be loaded from the beggining, it needs the DOM to be loaded
   * so we wait until is actually shown to create the mapview and show it
   */
  enableMap: function() {
    var self = this;
    if(!this.map_enabled) {
      var div = this.$('#map')
        , base_maps = this.$('.base_maps');

      this.baseLayerChooser = new cdb.admin.BaseMapChooser({
        model: this.map,
        baseLayers: this.options.baseLayers
      });

      base_maps.append(this.baseLayerChooser.render().el);


      var mapViewClass = cdb.geo.LeafletMapView;
      if(this.map.get('provider') === 'googlemaps') {
        mapViewClass = cdb.geo.GoogleMapsMapView;
      }

      this.mapView = new mapViewClass({
        el: div,
        map: this.map
      });

      this.clickTimeout = null;
      this._bindMissingClickEvents();

      this.map_enabled = true;

      this.mapView.bind('newLayerView', self._bindDataLayer, self);


      // bind data layer if it is already added to the map
      var dataLayer = this.map.get('dataLayer');
      if(dataLayer) {
        var dl = this.mapView.getLayerByCid(self.map.get('dataLayer').cid);
        this._bindDataLayer(dl);
      }

      var zoomControl = new cdb.geo.ui.Zoom({
        model:    this.map,
        template: cdb.templates.getTemplate("table/views/zoom_control")
      });
      this.$el.append(zoomControl.render().$el);
      this.zoom = zoomControl;

      // infowindow
      self.infowindow = new cdb.admin.MapInfowindow({
        model: self.infowindowModel,
        //template: cdb.templates.getTemplate('table/views/infowindow'),
        mapView: self.mapView,
        table: self.options.table
      });
      self.mapView.$el.append(self.infowindow.el);

      // editing geometry
      this.geometryEditor = new cdb.admin.GeometryEditor({
        model: this.options.table
      });
      this.geometryEditor.mapView = this.mapView;
      self.mapView.$el.append(self.geometryEditor.render().el);
      this.geometryEditor.hide();

      this.geometryEditor.bind('editStart', this.hideDataLayer, this);
      this.geometryEditor.bind('editDiscard', this.showDataLayer, this);
      this.geometryEditor.bind('editFinish', this.showDataLayer, this);
      this.geometryEditor.bind('editFinish', this.updateDataLayerView, this);
      self.infowindow.bind('editGeom', this.geometryEditor.editGeom, this.geometryEditor);
      self.infowindow.bind('removeGeom', this.updateDataLayerView, this);


      // HACK
      // wait a little bit to give time to the mapview
      // to estabilize
      setTimeout(function() {
        self.mapView.setAutoSaveBounds();
      }, 1000);

      var geoColumns = self.options.table.geomColumnTypes();
      if(!geoColumns || !geoColumns.length || geoColumns.length == 0) {
        this.showNoGeoRefWarning()
      }
    }
  },

  /**
   * this function binds click and dblclick events
   * in order to not raise click when user does a dblclick
   *
   * it raises a missingClick when the user clicks on the map
   * but not over a feature or ui component
   */
  _bindMissingClickEvents: function() {
    var self = this;
    this.mapView.bind('click', function(e) {
      if(self.clickTimeout === null) {
        self.clickTimeout = setTimeout(function() {
          self.clickTimeout = null;
          if(!self.featureHovered) {
            self.trigger('missingClick');
          }
        }, 150);
      }
      //google maps does not send an event
      if(!self.featureHovered && e.preventDefault) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    this.mapView.bind('dblclick', function() {
      if(self.clickTimeout !== null) {
        clearTimeout(self.clickTimeout);
        self.clickTimeout = null;
      }
    });
  },

  /**
   * when the layer view is created this method is called
   * to attach all the click events
   */
  _bindDataLayer: function(layer) {
    var self = this;
    if(layer.model.get('type') === 'CartoDB') {
      // unbind previos stuff
      if(self.layerDataView) {
        self.layerDataView.unbind(null, null, this);
      }

      self.layerDataView = self.mapView.getLayerByCid(self.map.get('dataLayer').cid);
      if(self.layerDataView) {
        self.layerDataView.bind('featureClick', self.featureClick, self);
        self.layerDataView.bind('featureOut', self.featureOut, self);
        self.layerDataView.bind('featureOver', self.featureOver, self);
      }
    }
  },

  featureOver: function(e, latlon, pxPos, data) {
    $(document.body).css('cursor', 'pointer');
    this.featureHovered = data;
  },

  featureOut: function() {
    $(document.body).css('cursor', 'auto');
    this.featureHovered = null;
  },

  featureClick: function(e, latlon, pxPos, data) {
    if(data.cartodb_id) {
      this.infowindow
        .setLatLng(latlon)
        .setFeatureInfo(data.cartodb_id)
        .showInfowindow();
    } else {
      cdb.log.error("can't show infowindow, no cartodb_id on data");
    }
  },

  _moveShareButton: function(type) {
    this.$el.find("div.share")
      .animate({
        right: type == "show" ? 592 : 57
      }, 400);
  },

  render: function() {
    this.$el.html('');
    this.$el.append(this.getTemplate('table/views/maptab')());
    return this;
  },

  shareMap: function(e) {
    e.preventDefault();
    var dlg = new cdb.admin.ShareMapDialog({
      map: this.model,
      table: this.options.table
    });
    dlg.appendToBody().open();
    return false;
  },

  addGeometry: function() {
    // row is saved by geometry editor if it is needed
    this.geometryEditor.createGeom(this.options.table.data().newRow(), 'polygon');
  },

  showDataLayer: function() {
    this.layerDataView.show();
  },

  hideDataLayer: function() {
    this.layerDataView.hide();
  },

  /**
   * reload tiles
   */
  updateDataLayerView: function() {
    this.layerDataView.reload();
  },
  /**
  * Paints a dialog with a warning when the user hasn't any georeferenced row
  * @method showNoGeorefWarning
  */
  showNoGeoRefWarning: function() {
      if(!this.noGeoRefDialog) {
        this.noGeoRefDialog = new cdb.admin.NoGeoRefDataDialog();
        this.retrigger('georeference', this.noGeoRefDialog);
        this.retrigger('manual', this.noGeoRefDialog);
      }

      this.noGeoRefDialog.render().$el.appendTo(this.$el);
  }


});
