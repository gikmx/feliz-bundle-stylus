'use strict'

const PATH    = require('path');
const Rx      = require('rxjs/Rx');
const Boom    = require('boom');
const Stylus  = require('stylus');

module.exports = function (request, reply){

    const getError = status => {
        const error = new Error();
        error.statusCode = status || 500;
        return error;
    };

    const param$ = Rx.Observable
        .of(PATH.normalize(request.params.filename))
        // if there's a leading `~` a bundle is being required
        // Bundles are stylus files located the bundles directory
        // otherwise, look for the css file on static
        .map(param => {
            let result;
            if (param[0] === '~') result = {
                root: this.path.app.bundles,
                name: param.slice(1, -4),
                type: 'bundle'
            };
            else result = {
                root: PATH.join(this.path.static, 'css'),
                name: param,
                type: 'static'
            }
            result.path = PATH.join(result.root, result.name);
            result.util = this.util.rx.path(result.path);
            return result;
        });

    // Static params always point to existing files on static
    const static_param$ = param$
        .filter(param => param.type == 'static')

    // bundle params can point to directories, first try to resolve them
    const bundle_param$ = param$
        .filter(param => param.type == 'bundle')
        .mergeMap(param => param.util
            .isDir()
            .map(isdir => {
                if (!isdir) param.path += '.styl';
                else {
                    param.root = param.path;
                    param.path = PATH.join(param.path, 'index.styl');
                }
                param.util = this.util.rx.path(param.path);
                return param;
            }))

    const file$ = Rx.Observable
        .merge(static_param$, bundle_param$)
        .mergeMap(param => param.util
            .isFile()
            .mergeMap(isfile => {
                if (!isfile) throw getError(404);
                return param.util.read()
            })
            .map(body => {
                param.body = body;
                delete param.util
                return param;
            })
        );

    const static_file$ = file$
        .filter(file => file.type == 'static');

    const bundle_file$ = file$
        .filter(file => file.type == 'bundle')
        .mergeMap(file => Rx.Observable.create(observer => {

            const options = this.options.stylus || {};

            if (!this.util.is(options.engine).array()) options.engine = [];
            if (!this.util.is(options.path).array()) options.path = [];

            let stylus = Stylus(file.body.toString('utf8')).set('filename', file.path);

            for (let i in options.engine) {
                let option = options.engine[i];
                if (!this.util.is(stylus[option.name]).function())
                    return observer.error(this.error.type({
                        name: 'plugins.stylus',
                        type: 'valid options',
                        data: stylus[option.name]
                    }));
                stylus = stylus[option.name].apply(stylus, option.args || []);
            }
            // const paths = stylus.options.paths
            //     .concat([file.root, this.path.app.bundles])
            //     .concat(options.path)

            stylus.render((err, css) => {
                if (err) return observer.error(err);
                file.body = css;
                observer.next(file);
                observer.complete();
            })
        }));

    Rx.Observable
        .merge(static_file$, bundle_file$)
        .subscribe(
            file => reply(file.body).type('text/css'),
            err  => {
                this.server.log('error',  err.message);
                reply(Boom.wrap(err, err.statusCode || 500))
            }
        )
}

