var express = require('express'),
    mongoose = require('mongoose'),
    Resource = require('../../index.js'),
    config = require('./config'),
    models = require('./models');

console.log(config);

mongoose.connect(config.mongodb,{ useNewUrlParser: true, useUnifiedTopology: true },function(err){
    if(err){
        return console.error(err);
    }
    console.log('connected to Mongo "%s"',config.mongodb);
    var app = require('./app');

    var server = app.listen(config.http,function(){
            console.log('listening on http port %d',server.address().port);
        });
});
