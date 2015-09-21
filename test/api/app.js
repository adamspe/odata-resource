var express = require('express'),
    Resource = require('../../index.js'),
    models = require('./models'),
    app = express();

app.get('/', function (req, res) {
  res.send('odata-resource test server');
});

var authors = new Resource({
        rel: '/api/authors',
        model: models.Author,
    }).instanceLink('books',function(req,res){
        var query = books.initQuery(books.getModel().find({_author: req._resourceId}),req);
        query.exec(function(err,books){
            if(err){
                return Resource.sendError(res,500,'error finding books',err);
            }
            res.send(books);
        });
    }),
    reviews = new Resource({
        rel: '/api/reviews',
        model: models.Review
    }),
    books = new Resource({
        rel: '/api/books',
        model: models.Book,
        $orderby: 'title',
        populate: '_author'
    }).instanceLink('reviews',{
        otherSide: reviews,
        key: '_book'
    }).staticLink('genres',function(req,res){
        this.getModel().distinct('genre',function(err,genres){
            if(err){
                return Resource.sendError(res,500,'error getting genres',err);
            }
            res.send(genres);
        });
    });

authors.initRouter(app);
reviews.initRouter(app);
books.initRouter(app);

module.exports = app;
