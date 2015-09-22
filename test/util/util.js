var mongoose = require('mongoose'),
    should = require('should'),
    config = require('../api/config'),
    models = require('../api/models'),
    app = require('../api/app'),
    api = require('supertest')(app);

var util = {
    models: models,
    api: api,
    cleanDb: function(done){
        var keys = Object.keys(mongoose.connection.collections);
        function _next() {
            if(keys.length) {
                mongoose.connection.collections[keys.pop()].remove(_next);
            } else {
                done();
            }
        }
        _next();
    },
    before: function(done) {
        mongoose.connect(config.mongodb,function(err){
            if(err) {
                throw err;
            }
            return util.cleanDb(done);
        });
    },
    after: function(done) {
        util.cleanDb(function(){
            mongoose.disconnect();
            done();
        });
    },
    testAuthor: function(author,expect) {
        author.should.have.property('firstname',expect.firstname);
        author.should.have.property('lastname',expect.lastname);
        author.should.have.property('_id',expect._id);
        author.should.have.property('_links').and.be.instanceof(Object);
        var links = author._links;
        links.should.have.property('self','/api/authors/'+expect._id);
        links.should.have.property('books','/api/authors/'+expect._id+'/books');
    },
    testBook: function(book,expect,expectAuthor) {
        book.should.have.property('title',expect.title);
        book.should.have.property('genre',expect.genre);
        book.should.have.property('_id',expect._id);
        book.should.have.property('_links').and.be.instanceof(Object);
        var links = book._links;
        links.should.have.property('self','/api/books/'+expect._id);
        links.should.have.property('reviews','/api/books/'+expect._id+'/reviews');
        book.should.have.property('_author').and.be.instanceof(Object);
        // TODO add links to populated attributes?
        //testAuthor(book._author,expectAuthor);
        var author = book._author;
        author.should.have.property('firstname',expectAuthor.firstname);
        author.should.have.property('lastname',expectAuthor.lastname);
        author.should.have.property('_id',expectAuthor._id);
    },
    testReview: function(review,expect) {
        review.should.have.property('content',expect.content);
        review.should.have.property('stars',expect.stars);
        review.should.have.property('_id',expect._id);
        review.should.have.property('_book',expect._book);
        review.should.have.property('_links').and.be.instanceof(Object);
        review._links.should.have.property('self','/api/reviews/'+expect._id);
    },
    testError: function(err,expect) {
        err.should.have.property('status',expect.status);
        err.should.have.property('message',expect.message);
    }
};

module.exports = util;