'use strict';

const Joi = require('joi');

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
        const options = this.options.stylus || {};
        options.route = options.route || '/static/css';
        this.server.route({
            method  : 'GET',
            path    : `${options.route}/{filename*}`,
            config  : {
                validate: {
                    params: {
                        filename: Joi
                            .string()
                            .min(5)
                            .required()
                            .regex(/[^\.]+\.css/)
                    }
                }
            },
            handler : Handler.bind(this)
        })
    }}
};

// required by hapi
module.exports.data.register.attributes = { pkg: Package }

