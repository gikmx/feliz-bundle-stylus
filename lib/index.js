'use strict';

const Bundler = require('feliz-bundler');
const Package = require('./package.json');
const Handler = require('./handler');

module.exports = {
    name: 'stylus',
    data: {
        register: function(server, options, next){
            next();
        }
    },
    when: { 'plugin:stylus': function(){

        if (!this.util.is(this.options.stylus).object()) this.options.stylus = {};
        const options = this.util
            .object({
                index: 'index',
                ext  : { target:'css', source:'styl' },
                route: '/static',
                callback: Handler
            })
            .merge(this.options.stylus);
        Bundler.call(this, options);
    }}
};

// required by hapi
module.exports.data.register.attributes = { pkg: Package }

