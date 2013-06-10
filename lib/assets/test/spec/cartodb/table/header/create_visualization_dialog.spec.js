describe("Create visualization dialog", function() {
  var view, vis;

  beforeEach(function() {
    vis = TestUtil.createVis("test");
    view = new cdb.admin.CreateVizDialog({ model: vis, msg: 'Nothing' });
  });

  it("should render properly", function() {
    view.render();
    expect(view.$('input[type="text"]').length).toEqual(1);
    expect(view.$('input[type="text"]').attr('placeholder')).toEqual('Name your visualization');
    expect(view.$('div.info').length).toEqual(1);
    expect(view.$('.modal').size()).toBe(3)
  });

  it("shouldn't change the state after adding an invalid value", function() {
    view.render();

    var $input = view.$('input');
    spyOn(view, '_showInputError');
    spyOn(view, 'hide');
    
    $input
      .val('')
      .trigger(jQuery.Event( 'keydown', {
          keyCode: 13
        })
      );

    expect(view._showInputError).toHaveBeenCalled();
    expect(view.hide).not.toHaveBeenCalled();
  });

  it("should change the state after adding a valid value", function() {
    view.render();

    var $input = view.$('input');
    spyOn(view, '_hideInputError');
    spyOn(view, 'hide');
    
    $input
      .val('new vis name')
      .trigger(jQuery.Event( 'keydown', {
          keyCode: 13
        })
      );

    expect(view._hideInputError).toHaveBeenCalled();
    expect(view.state).toBe(1);
    expect(view.new_vis_name).toBe('new vis name');
  });

  it("should create a new visualization", function() {
    view.render();

    var done = false;
    view.ok = function() {
      done = true;
    }
    spyOn(view, 'hide');

    var server = sinon.fakeServer.create();

    view.$('input')
      .val('new vis name')
      .trigger(jQuery.Event( 'keydown', {
          keyCode: 13
        })
      );

    server.respondWith('/api/v1/viz', [200, { "Content-Type": "application/json" }, '{}']);
    server.respond();
    
    expect(done).toBeTruthy();
    // yes, we decide if the dialog should close or not
    expect(view.hide).not.toHaveBeenCalled();
  });

  it("shouldn't create a new visualization if server fails", function() {
    view.render();

    var done = false;
    view.ok = function() {
      done = true;
    }
    spyOn(view, 'hide');

    var server = sinon.fakeServer.create();

    view.$('input')
      .val('new vis name')
      .trigger(jQuery.Event( 'keydown', {
          keyCode: 13
        })
      );

    server.respondWith('/api/v1/viz', [400, { "Content-Type": "application/json" }, '{}']);
    server.respond();
    
    expect(done).toBeFalsy();
    expect(view.hide).not.toHaveBeenCalled();
  });
  
});