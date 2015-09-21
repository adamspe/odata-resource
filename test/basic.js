var should = require('should'),
    mongoose = require('mongoose'),
    config = require('./api/config'),
    models = require('./api/models'),
    app = require('./api/app'),
    api = require('supertest')(app);

function cleanDb(done) {
    for(var i in mongoose.connection.collections){
        mongoose.connection.collections[i].remove(function(){});
    }
    return done();
}

describe('Basic Read',function(){
    var theAuthor = {
            firstname: 'Joe',
            lastname: 'Author'
        },
        theBooks = [{
            title: 'B: Exciting Book',
            genre: 'Action'
        },{
            title: 'A: Sad Book',
            genre: 'Drama'
        }],
        theReviews = [{
            content: 'Loved it!',
            stars: 5
        },{
            content: 'Hated it!',
            stars: 1
        }];

    before(function(done){
        mongoose.connect(config.mongodb,function(err){
            if(err) {
                throw err;
            }
            return cleanDb(function(){
                models.Author.create(theAuthor,function(err,author){
                    should.not.exist(err);
                    theAuthor._id = author._id.toString();
                    theBooks.forEach(function(book){
                        book._author = theAuthor._id;
                    });
                    models.Book.create(theBooks,function(err,books){
                        if(err) {
                            throw err;
                        }
                        books.forEach(function(b,i) {
                            theBooks[i]._id = b._id.toString();
                        });
                        theReviews.forEach(function(r){
                            r._book = theBooks[0]._id;
                        });
                        models.Review.create(theReviews,function(err,reviews){
                            if(err) {
                                throw err;
                            }
                            reviews.forEach(function(r,i){
                                theReviews[i]._id = r._id.toString();
                            });
                            done();
                        });
                    });
                });
            });
        });
    });

    after(function(done){
        cleanDb(function(){
            mongoose.disconnect();
            return done();
        });
    });

    function testAuthor(author) {
        author.should.have.property('firstname',theAuthor.firstname);
        author.should.have.property('lastname',theAuthor.lastname);
        author.should.have.property('_id',theAuthor._id);
        author.should.have.property('_links').and.be.instanceof(Object);
        var links = author._links;
        links.should.have.property('self','/api/authors/'+theAuthor._id);
        links.should.have.property('books','/api/authors/'+theAuthor._id+'/books');
    }

    function testBook(book,expect) {
        book.should.have.property('title',expect.title);
        book.should.have.property('genre',expect.genre);
        book.should.have.property('_id',expect._id);
        book.should.have.property('_links').and.be.instanceof(Object);
        var links = book._links;
        links.should.have.property('self','/api/books/'+expect._id);
        links.should.have.property('reviews','/api/books/'+expect._id+'/reviews');
        book.should.have.property('_author').and.be.instanceof(Object);
        // TODO add links to populated attributes?
        //testAuthor(book._author);
        var author = book._author;
        author.should.have.property('firstname',theAuthor.firstname);
        author.should.have.property('lastname',theAuthor.lastname);
        author.should.have.property('_id',theAuthor._id);
    }

    function testReview(review,expect) {
        review.should.have.property('content',expect.content);
        review.should.have.property('stars',expect.stars);
        review.should.have.property('_id',expect._id);
        review.should.have.property('_book',expect._book);
        review.should.have.property('_links').and.be.instanceof(Object);
        review._links.should.have.property('self','/api/reviews/'+expect._id);
    }

    describe('author',function(){
        // simple query, no filter
        it('list should just be one',function(done){
            api.get('/api/authors')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                    testAuthor(res.body.list[0]);
                    return done();
               });
        });

        // simple fetch
        it('get should find the one',function(done){
            api.get('/api/authors/'+theAuthor._id)
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    testAuthor(res.body);
                    return done();
               });
        });

        it('should report not found',function(done){
            api.get('/api/authors/blah')
                .expect(404)
                .expect('Content-Type', /json/)
                .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    res.body.should.have.property('status',404);
                    res.body.should.have.property('message','not found');
                    return done();
                });
        });

        it('should get an authors books',function(done){
            api.get('/api/authors/'+theAuthor._id+'/books')
               .expect(200)
                .expect('Content-Type', /json/)
                .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                    testBook(res.body.list[0],theBooks[1]);
                    testBook(res.body.list[1],theBooks[0]);
                    res.body.should.have.property('_links').and.be.instanceof(Object);
                    var links = res.body._links;
                    links.should.have.property('genres','/api/books/genres');
                    return done();
                });
        });
    });

    describe('book',function(){
        function booksOrderBy(done,asc){
            return function(err,res) {
                if(err) {
                    return done(err);
                }
                res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                res.body.list.forEach(function(b,i) {
                    if(asc) {
                        // the default $orderby is title so the books should be in opposite order than they were created
                        testBook(b,i === 0 ? theBooks[1] : theBooks[0]);
                    } else {
                        testBook(b,theBooks[i]);
                    }
                });

                // static links
                res.body.should.have.property('_links').and.be.instanceof(Object);
                res.body._links.should.have.property('genres','/api/books/genres');

                //console.log(res.body);
                return done();
            };
        }
        it('default list',function(done){
            api.get('/api/books')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(booksOrderBy(done,true));
        });
        it('explicit list $orderby asc',function(done){
            api.get('/api/books?$orderby=title asc')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(booksOrderBy(done,true));
        });
        it('explicit list $orderby desc',function(done){
            api.get('/api/books?$orderby=title desc')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(booksOrderBy(done,false));
        });
        it('static link genres',function(done){
            api.get('/api/books/genres')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Array).with.lengthOf(2);
                    (res.body[0]).should.be.exactly('Action');
                    (res.body[1]).should.be.exactly('Drama');
                    return done();
               });
        });
        function testGetBook(i) {
            return function(done) {
                api.get('/api/books/'+theBooks[i]._id)
                   .expect(200)
                   .expect('Content-Type', /json/)
                   .end(function(err,res){
                        if(err) {
                            return done(err);
                        }
                        res.body.should.be.instanceof(Object);
                        testBook(res.body,theBooks[i]);
                        return done();
                   });
            };
        }
        it('simple book get [0]',testGetBook(0));
        it('simple book get [1]',testGetBook(1));

        // the first book should have two reviews
        function testOrderedReviews(done,asc) {
            return function(err,res) {
                if(err) {
                    return done(err);
                }
                res.body.should.be.instanceof(Object);
                res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                res.body.list.forEach(function(r,i) {
                    if(asc) {
                        testReview(r,theReviews[i === 0 ? 1 : 0]);
                    } else {
                        testReview(r,theReviews[i]);
                    }
                });
                return done();
            };
        };
        it('book with reviews (asc)',function(done) {
            api.get('/api/books/'+theBooks[0]._id+'/reviews?$orderby=stars asc')
               .expect('Content-Type', /json/)
               .end(testOrderedReviews(done,true));
        });
        it('book with reviews (desc)',function(done) {
            api.get('/api/books/'+theBooks[0]._id+'/reviews?$orderby=stars desc')
               .expect('Content-Type', /json/)
               .end(testOrderedReviews(done,false));
        });
        it('book with no reviews',function(done) {
            api.get('/api/books/'+theBooks[1]._id+'/reviews')
               .expect('Content-Type', /json/)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(0);
                    return done();
               });
        });
    });
});