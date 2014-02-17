require.register('markdown.js', function(module, exports) {
  exports.parse = markdown.toHTML;
  exports.render = function (source, locals, callback) {
    callback(markdown.toHTML(source));
  }
});

var jade = require('jade');

require.register('jade.js', function (module, exports) {
  exports.render = function (source, locals, callback) {
    var fn = jade.compile(source, { pretty: true });
    callback(fn(locals));
  };
});

require.register('mustache.js', function (module, exports) {
  exports.render = function (source, locals, callback) {
    callback(Mustache.to_html(source, locals));
  }
});

require.register('handlebars.js', function (module, exports) {
  exports.render = function (source, locals, callback) {
    var template = Handlebars.compile(source);
    callback(template(locals));
  }
});

require.register('plates.js', function (module, exports) {
  exports.render = function (source, locals, callback) {
    callback(Plates.bind(source, locals));
  }
});

require.register('jsrender.js', function (module, exports) {
  exports.render = function (source, locals, callback) {
    $.template('__render', source);
    var html = $.render(locals, '__render');
    callback(html);
  };
});

require.register('underscore.js', function (module, exports) {
  exports.render = function (source, locals, callback) {
    callback(_.template(source)(locals));
  };
});

require.register('less.js', function (module, exports) {
  var less = new window.less.Parser;
  exports.render = function (source, locals, callback) {
    less.parse(source, function (err, tree) {
      if (err) {
        var e = new Error();
        e.type = err.name;
        e.message = err.message;
        e.line = err.line;
        throw e;
      }
      callback(tree.toCSS());
    });
  };
});

require.register('coffee-script.js', function (module, exports) {
  exports.render = function (source, locals, callback) {
    callback(CoffeeScript.compile(source, { bare:true }));
  };
});

var parsers = {},
    lang = 'jade',
    languages = ['Coffee-Script', 'Jade', 'Markdown', 'Mustache', 'LESS', 'JsRender', 'Handlebars', 'Plates', 'Underscore'].sort(function (a, b) { return a.toLowerCase() > b.toLowerCase() }),
    locals = {},
    qs = getQueryString();

languages.forEach(function (lang) {
  lang = lang.toLowerCase();
  parsers[lang] = require(lang);
});

function getQueryString() {
  var result = {}, queryString = location.search.substring(1),
      re = /([^&=]+)=([^&]*)/g, m;

  while (m = re.exec(queryString)) {
    result[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
  }

  return result;
}


function throttle(fn, delay) {
  var timer = null;
  return function () {
    var context = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, delay);
  };
}

jQuery(function ($) {
  $.event.special.updated = {
    setup: function (data, namespaces) {
      $(this).on('keyup', keyup).data('last', this.value);
    },
    teardown: function () {
      $(this).off('keyup', keyup).removeData('last');
    }
  };

  function keyup(event) {
    var last = $.data(this, 'last'),
        content = this.value;
    if (content !== last) {
      $(this).trigger('updated');
      last = content;
      $.data(this, 'last', last);
    }
  }
});

$(function () {
  var $render = $('#render'),
      $source = $('#source'),
      $error = $('pre p'),
      $locals = $('#locals'),
      $lang = $('#lang'),
      last = null;

  var html = '';
  languages.forEach(function (lang) {
    html += '<option value="' + lang.toLowerCase() + '">' + lang + '</option>';
  });

  $lang.html(html).change(function () {
    lang = this.value;
    update();
  }).val('jade');

  var $showLocals = $('#showlocals').click(function () {
    $locals[this.checked ? 'show' : 'hide']();
  });

  $('#source, #locals').on('updated', throttle(update, 250));

  var config = JSON.parse(localStorage.config || 'null');
  if (config) {
    $source.val(config.source);
    $locals.val(config.locals);
    $showLocals[0].checked = config.showLocals;
    if (config.showLocals) $locals.show();
    $lang.val(config.lang);
    lang = config.lang;
  }

  if (qs.source) $source.val(qs.source);
  if (qs.lang) { $lang.val(qs.lang); lang = qs.lang; }
  if (qs.locals) { $locals.val(qs.locals); $showLocals[0].checked = true; $locals.show(); }

  window.getpath = function () {
    return '?source=' + encodeURIComponent($source.val()) + '&lang=' + encodeURIComponent(lang) + '&locals=' + encodeURIComponent($locals.val());
  };

  update();

  $(window).unload(function () {
    localStorage.config = JSON.stringify({
      lang: $lang.val(),
      source: $source.val(),
      locals: $locals.val(),
      showLocals: $showLocals.is(':checked')
    });
  });

  var historyTimer = null;
  function update() {
    var source = $source.val(), ok = false, error = '';
    clearTimeout(historyTimer);
    setTimeout(function () {
      window.history.pushState('', '', getpath());
    }, 1000);

    try {
      try {
        locals = (new Function('var alert = prompt = confirm = function(){}; return ' + $locals.val()))();
      } catch (e) {
        throw new Error('Cannot parse locals - try valid JSON');
      }

      if (parsers[lang]) {
        parsers[lang].render(source, locals, function (renderedSource) {
          ok = true;
          $render.parent().removeClass('error');
          $render.text(renderedSource);
        });
      } else {
        throw new Error('Language (' + lang + ') not supported');
      }
    } catch (e) {
      ok = false;
      error = e.toString();
    }

    if (!ok) {
      $render.parent().addClass('error');
      $error.text(error);
    }
  }
});
