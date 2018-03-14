var should = require('should'),
    util = require('./util/util'),
    models = util.models,
    api = util.api;


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
        util.before(function(){
            models.Author.create(theAuthor,function(err,author){
                if(err) {
                    throw err;
                }
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


    after(util.after);

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
                    util.testAuthor(res.body.list[0],theAuthor);
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
                    util.testAuthor(res.body,theAuthor);
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
                    util.testBook(res.body.list[0],theBooks[1],theAuthor);
                    util.testBook(res.body.list[1],theBooks[0],theAuthor);
                    res.body.should.have.property('_links').and.be.instanceof(Object);
                    var links = res.body._links;
                    links.should.have.property('genres','/api/books/genres');
                    // not turned on by default
                    links.should.not.have.property('count');
                    return done();
                });
        });

        it('should not support count',function(done) {
            api.get('/api/authors/count')
                .expect(404)
                .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
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
                        util.testBook(b,i === 0 ? theBooks[1] : theBooks[0],theAuthor);
                    } else {
                        util.testBook(b,theBooks[i],theAuthor);
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
                        util.testBook(res.body,theBooks[i],theAuthor);
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
                res.body.should.have.property('_links').and.be.instanceof(Object);
                res.body._links.should.have.property('count','/api/books/'+theBooks[0]._id+'/reviews/count');
                res.body.should.be.instanceof(Object);
                res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                res.body.list.forEach(function(r,i) {
                    if(asc) {
                        util.testReview(r,theReviews[i === 0 ? 1 : 0]);
                    } else {
                        util.testReview(r,theReviews[i]);
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

        it('should count two books',function(done){
            api.get('/api/books/count')
                .expect(200)
                .expect('Content-Type',/json/)
                .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Number).and.equal(2);
                    return done();
                });
        });

        it('book with reviews count two',function(done) {
            api.get('/api/books/'+theBooks[0]._id+'/reviews/count')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Number).and.equal(2);
                    return done();
                });
        });

        it('single $expand',function(done) {
            api.get('/api/reviews/'+theReviews[0]._id+'?$expand=_book')
                .expect(200)
                .expect('Content-Type',/json/)
                .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('_book').and.be.instanceof(Object);
                    util.testBook(res.body._book,theBooks[0],theAuthor,true/*no _links*/,true/*author not expanded*/);
                    done();
                });
        });

        it('nested $expand',function(done) {
            api.get('/api/reviews/'+theReviews[0]._id+'?$expand=_book._author')
                .expect(200)
                .expect('Content-Type',/json/)
                .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('_book').and.be.instanceof(Object);
                    util.testBook(res.body._book,theBooks[0],theAuthor,true/*no _links*/);
                    done();
                });
        });
    });
});
