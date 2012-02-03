var bsoup = bsoup || {};

(function () {
    if (!Array.indexOf) {
        Array.prototype.indexOf = function (o) {
            for (var i = 0; i < this.length; i++) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }
})();

(function (pkg) {
    var links = document.getElementsByTagName("link");
    for (var i = 0; i < links.length; i++) {
        if (links[i].rel == "EditURI") {
            pkg.id = links[i].href.split("=")[1];
            break;
        }
    }
})(bsoup);

(function (pkg) {
    pkg.namespace = function (path, def) {
        if (path.indexOf('.') == -1) {
            return pkg[path] = pkg[path] || (def || {});
        }
        var vs = path.split('.'), p = pkg;
        for (var i = 0; i < vs.length; i++) {
            if (i + 1 != vs.length) {
                p = p[vs[i]] = p[vs[i]] || {};
            } else {
                return p[vs[i]] = def || (p[vs[i]] || {});
            }
        }
        return p;
    };
    pkg.init = function (params) {
        pkg.id = params.id;
    };
})(bsoup);

(function (pkg) {
    var storage = pkg.namespace("util.storage", {
        get: function () { return null; },
        put: function () { },
        add: function () { },
        remove: function () { },
        contains: function () { return false; }
    });

    if (!(localStorage && JSON)) return;

    var isExpiry = function (data) {
        if (data.expire) {
            var expire = new Date(data.expire);
            if (expire.getTime() > new Date().getTime()) return false;
        } else {
            return false;
        }
        return true;
    };

    storage.get = function (key, vkey) {
        var data = JSON.parse(localStorage.getItem(key));
        if (data) {
            if (!isExpiry(data)) return data.value;
            localStorage.removeItem(key);
        }
        return null;
    };

    storage.put = function (key, value, expire) {
        var data = { value: value };
        var date = new Date();
        if (expire) date.setTime(date.getTime() + expire);
        else date.setTime(date.getTime() + (60 * 60 * 24 * 7 * 1000));
        data.expire = date.toString();
        localStorage.setItem(key, JSON.stringify(data));
    };

    storage.add = function (key, value, expire) {
        if (storage.contains(key)) {
            var data = storage.get(key);
            for (var i in value) data[i] = value[i];
            storage.put(key, data, expire);
        } else {
            storage.put(key, value, expire);
        }
    };

    storage.remove = function (key) {
        localStorage.removeItem(key);
    };

    storage.contains = function (key) {
        if (!(key in localStorage)) return false;
        var data = JSON.parse(localStorage.getItem(key));
        if (!isExpiry(data)) return true;
        else localStorage.removeItem(key);
        return false;
    };
})(bsoup);

(function (pkg) {
    var picasa = pkg.namespace("util.picasa");

    picasa.changeOption = function (uri, option) {
        if (uri.search(/^(http|https)+\:\/\/lh\d+\.googleusercontent.com\//i) == -1 &&
        uri.search(/^(http|https)+\:\/\/\d+\.bp\.blogspot\.com\//i) == -1 &&
        uri.search(/^(http|https)+\:\/\/lh\d+\.ggpht.com\//i) == -1) return uri;

        var array = uri.split('/');
        if (array.length == 9) array[7] = option;
        else if (array.length == 8) array[7] = option + '/' + array[7];
        else return null;

        return array.join('/');
    };
})(bsoup);

(function (pkg) {
    var feed = pkg.namespace("util.feed");
    feed.api = "http://www.blogger.com/feeds/";
})(bsoup);

(function (pkg) {
    var feed = pkg.namespace("util.feed");
    var builder = pkg.namespace("util.feed.builder");

    builder.entry = function (c) {
        var f = {};
        var type = "default", labels = [];

        f.type = function (t) { type = t; return f; };
        f.label = function (l) { labels = l; return f; };
        f.build = function () {
            var array = [feed.api, pkg.id, "/posts/", type];
            if (labels.length > 0) {
                var label = "/-/";
                for (var i = 0; i < labels.length; i++) {
                    label += encodeURI(labels[i]) + '/';
                }
                array.push(label);
            }
            return array.join('');
        };

        return f;
    };
})(bsoup);

(function (pkg) {
    var feed = pkg.namespace("util.feed");
    var builder = pkg.namespace("util.feed.builder");

    builder.comment = function () {
        var f = {};
        var type = "default", id = -1;

        f.type = function (t) { type = t; return f; };
        f.entryId = function (i) { id = i; return f; };
        f.build = function () {
            var array = [feed.api, pkg.id, '/'];
            if (id !== -1) array.push(id + '/');
            array.push("comment/");
            array.push(type);
            return array.join('');
        };

        return f;
    };

})(bsoup);

(function (pkg) {
    var builder = pkg.namespace("util.feed.builder");

    builder.query = function () {
        var f = {};
        var params = { alt: "json" }, umax = -1, umin = -1, offset = null;

        f.orderby = function (o) { params["orderby"] = o; return f; };
        f.limits = function (l) { params["max-results"] = l; return f; };
        f.utcMax = function (m) { umax = m; return f; };
        f.utcMin = function (m) { umin = m; return f; };
        f.utcOffset = function (o) { offset = o; return f; };
        f.offset = function (o) { params["start-index"] = o; return f; };
        f.path = function (uri) {
            uri.match(/^(.+?):\/\/(.+?):?(\d+)?(\/.*)?$/);
            params["path"] = RegExp.$4; return f;
        };
        f.build = function () {
            if (params["orderby"] != undefined) {
                var maxKey, minKey;
                if (params["orderby"] === "published") {
                    maxKey = "published-max";
                    minKey = "published-min";
                } else if (params["orderby"] === "updated") {
                    maxKey = "update-max";
                    minKey = "update-min";
                }
                if (umax != -1) params[maxKey] = convertUTCDate(umax, offset);
                if (umin != -1) params[minKey] = convertUTCDate(umin, offset);
            }
            return params;
        };

        var convertUTCDate = function (date, offset) {
            var format = function (value) {
                if (value < 10) value = '0' + value;
                return value;
            };
            var dt = new Date(date * 1000);
            var year = dt.getUTCFullYear();
            if (year < 2000) year += 1900;
            var month = format(dt.getUTCMonth() + 1);
            var day = format(dt.getUTCDate());
            var hour = format(dt.getUTCHours());
            var min = format(dt.getUTCMinutes());
            var sec = format(dt.getUTCSeconds());
            return [year, "-", month, "-", day, 'T', hour, ':', min, ':', sec, offset].join('');
        };

        return f;
    };
})(bsoup);

(function (pkg) {
    var feed = pkg.namespace("util.feed");

    feed.fetch = function (request, query, callback) {
        jQuery.getJSON(request.build() + "?callback=?", query.build(), callback);
    };
})(bsoup);

(function (pkg) {
    var entry = pkg.namespace("util.feed.entry");

    entry.facade = function (entry) {
        var f = {};

        f.raw = function () { return entry; };
        f.title = function () { return entry.title.$t; };
        f.uri = function () {
            for (var i = 0; i < entry.link.length; i++) {
                var link = entry.link[i];
                if (link.rel == "alternate") return link.href;
            }
            return null;
        };
        f.content = function () { return entry.content.$t; };
        f.updated = function () { return new Date(entry.updated.$t); };
        f.published = function () { return new Date(entry.published.$t); };
        f.label = function () {
            var r = [], c = entry.category;
            for (var i = 0; i < c.length; i++) r.push(c[i].term);
            return r;
        };
        f.image = function (o) {
            var c = entry.content.$t;
            var img = jQuery(c).find("img:first");
            if (img.length != 1) return null;
            var src = img.attr("src");
            if (src.indexOf("https://blogger.googleusercontent.com/tracker/") != -1) return null;
            return pkg.util.picasa.changeOption(src, o || "s300-c");
        };
        return f;
    };
})(bsoup);

(function (pkg) {
    var ajax = pkg.namespace("ajax.impl");

    ajax.related = function (arg) {
        var f = {}, labels = [], deny = [], callback = null, max = 20;

        f.callback = function (c) { callback = c; return f; };
        f.label = function (l) { if (l != "Old") labels.push(l); return f; };
        f.deny = function (d) { deny.push(d); return f; };
        f.max = function (m) { max = m; return f; };

        var shuffle = function (array) {
            var pool, target;
            var length = array.length;
            for (var i = 0; i < length * 10; i++) {
                target = Math.floor(Math.random() * length);
                pool = array[target];
                array.splice(target, 1);
                array.push(pool);
                array.reverse();
            }
            return array;
        };

        f.execute = function () {
            if (labels.length == 0) return;

            var result = [], unique = {};
            var uriBuilder = pkg.util.feed.builder.entry();
            var queryBuilder = pkg.util.feed.builder.query();
            var fetch = pkg.util.feed.fetch;

            fetch(uriBuilder.label(labels), queryBuilder.limits(max), function (data) {
                var entries = data.feed.entry;
                var facade = pkg.util.feed.entry.facade;
                for (var i = 0; i < entries.length; i++) {
                    var entry = facade(entries[i]);
                    var uri = entry.uri();
                    if (uri && entry.label().indexOf('Old') == -1 && deny.indexOf(uri) == -1 && !(uri in unique)) {
                        unique[uri] = true;
                        result.push(entry);
                    }
                }
                if (result.length < max && labels.length > 0) {
                    fetch(uriBuilder.label([encodeURI(labels.shift())]), queryBuilder.limits(max), arguments.callee);
                } else {
                    if (callback) {
                        callback(result);
                        return;
                    }
                    result = shuffle(result);
                    var ul = jQuery("<ul />");
                    for (var j = 0; j < result.length && j < max; j++) {
                        var v = result[j];
                        jQuery("<li />").append(
                            jQuery("<a />").attr("href", v.uri()).text(v.title()),
                            jQuery("<span />").attr("class", "label").text(v.label().join(', '))
                        ).appendTo(ul);
                    }
                    jQuery(function () {
                        ul.appendTo(arg.element);
                    });
                }
            });
        };
        return f;
    };
})(bsoup);

(function (pkg) {
    var ajax = pkg.namespace("ajax.impl");

    ajax.entry = function (arg) {
        var uri = arg.uri;
        var f = {}, callback = [], storage = pkg.util.storage;

        f.title = function (e) {
            var render = function (title) { jQuery(function () { jQuery(e).text(title); }); };
            var data = storage.get(uri);
            if (data && "title" in data) {
                render(data.title);
            } else {
                callback.push(function (entry) {
                    var title = entry.title();
                    storage.add(uri, { title: title });
                    render(title);
                });
            }
            return f;
        };

        f.label = function (e, s) {
            var render = function (label) { jQuery(function () { jQuery(e).text(label.join(s)); }); };
            var data = storage.get(uri);
            if (data && "label" in data) {
                render(data.label);
            } else {
                callback.push(function (entry) {
                    var label = entry.label();
                    storage.add(uri, { label: label });
                    render(label);
                });
            }
            return f;
        };

        f.image = function (e, o) {
            var render = function (src) { jQuery(function () { jQuery(e).attr("src", src); }); };
            var data = storage.get(uri);
            if (data && "image" in data) {
                render(data.image);
            } else {
                callback.push(function (entry) {
                    var src = entry.image();
                    if (src) {
                        storage.add(uri, { image: src });
                        render(src);
                    }
                });
            }
            return f;
        };

        f.callback = function (c) { callback.push(c); return f; };

        f.execute = function () {
            var uriBuilder = pkg.util.feed.builder.entry();
            var queryBuilder = pkg.util.feed.builder.query();
            pkg.util.feed.fetch(uriBuilder, queryBuilder.path(uri).limits(1), function (data) {
                var entries = data.feed.entry;
                var facade = pkg.util.feed.entry.facade;
                if (entries.length == 1) {
                    var entry = entries[0];
                    for (var i = 0; i < callback.length; i++) {
                        callback[i](facade(entry));
                    }
                }
            });
        };

        return f;
    };
})(bsoup);

(function (pkg) {
    var ajax = pkg.namespace("ajax");

    ajax.query = function (arg) {
        return ({
            entry: pkg.ajax.impl.entry(arg),
            related: pkg.ajax.impl.related(arg)
        }[arg.type]);
    };
})(bsoup);