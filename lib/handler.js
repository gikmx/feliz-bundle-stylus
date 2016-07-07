'use strict'

const PATH    = require('path');
const Rx      = require('rxjs/Rx');
const Boom    = require('boom');
const Stylus  = require('stylus');

module.exports = function (file$, request, reply, options){

    const static_file$ = file$
        .filter(file => file.type == 'static');

    const bundle_file$ = file$
        .filter(file => file.type == 'bundle')
        .mergeMap(file => Rx.Observable.create(observer => {

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

