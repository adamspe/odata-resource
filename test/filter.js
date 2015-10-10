var should = require('should'),
    util = require('./util/util'),
    models = util.models,
    api = util.api;


describe('Filter',function(){
    var authorOne = {
            firstname: 'Joe',
            lastname: 'Author'
        },
        authorTwo = {
            firstname: 'William',
            lastname: 'Writer'
        },
        theBooks = [{
            title: 'B: Exciting Book',
            genre: 'Action',
            pages: 10
        },{
            title: 'A: Depressing Book',
            genre: 'Drama',
            pages: 200
        },{
            title: 'C: Another Book',
            genre: 'Action',
            pages: 15
        },{
            title: 'D: Dragons',
            genre: 'Fantasy',
            pages: 120
        }];

    before(function(done){
        util.before(function(){
            models.Author.create([authorOne,authorTwo],function(err,authors){
                if(err) {
                    throw err;
                }
                authorOne._id = authors[0]._id.toString();
                authorTwo._id = authors[1]._id.toString();
                theBooks[0]._author = authorOne._id;
                theBooks[1]._author = authorOne._id;
                theBooks[2]._author = authorTwo._id;
                theBooks[3]._author = authorTwo._id;
                models.Book.create(theBooks,function(err,books){
                    if(err) {
                        throw err;
                    }
                    books.forEach(function(b,i) {
                        theBooks[i]._id = b._id.toString();
                    });
                    done();
                });
            });
        });
    });


    after(util.after);

    it('eq',function(done){
            api.get('/api/books?$filter=title eq \'B: Exciting Book\'')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                    util.testBook(res.body.list[0],theBooks[0],authorOne);
                    done();
               });
    });

    it('ne',function(done){
            api.get('/api/books?$filter=title ne \'B: Exciting Book\'&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(3);
                    util.testBook(res.body.list[0],theBooks[1],authorOne);
                    util.testBook(res.body.list[1],theBooks[2],authorTwo);
                    util.testBook(res.body.list[2],theBooks[3],authorTwo);
                    done();
               });
    });

    it('lt',function(done){
            api.get('/api/books?$filter=pages lt 120&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                    util.testBook(res.body.list[0],theBooks[0],authorOne);
                    util.testBook(res.body.list[1],theBooks[2],authorTwo);
                    done();
               });
    });

    it('le',function(done){
            api.get('/api/books?$filter=pages le 120&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(3);
                    util.testBook(res.body.list[0],theBooks[0],authorOne);
                    util.testBook(res.body.list[1],theBooks[2],authorTwo);
                    util.testBook(res.body.list[2],theBooks[3],authorTwo);
                    done();
               });
    });

    it('gt',function(done){
            api.get('/api/books?$filter=pages gt 120&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                    util.testBook(res.body.list[0],theBooks[1],authorOne);
                    done();
               });
    });

    it('ge',function(done){
            api.get('/api/books?$filter=pages ge 120&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                    util.testBook(res.body.list[0],theBooks[1],authorOne);
                    util.testBook(res.body.list[1],theBooks[3],authorTwo);
                    done();
               });
    });

    it('startswith',function(done){
            api.get('/api/books?$filter=startswith(title,\'A\')&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                    util.testBook(res.body.list[0],theBooks[1],authorOne);
                    done();
               });
    });

    it('endswith',function(done){
            api.get('/api/books?$filter=endswith(title,\'Book\')&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(3);
                    util.testBook(res.body.list[0],theBooks[1],authorOne);
                    util.testBook(res.body.list[1],theBooks[0],authorOne);
                    util.testBook(res.body.list[2],theBooks[2],authorTwo);
                    done();
               });
    });

    it('contains',function(done){
            api.get('/api/books?$filter=contains(title,\'ing\')&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                    util.testBook(res.body.list[0],theBooks[1],authorOne);
                    util.testBook(res.body.list[1],theBooks[0],authorOne);
                    done();
               });
    });

    it('in',function(done){
            api.get('/api/books?$filter=in(pages,10,15)&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                    util.testBook(res.body.list[0],theBooks[0],authorOne);
                    util.testBook(res.body.list[1],theBooks[2],authorTwo);
                    done();
               });
    });

    it('notin',function(done){
            api.get('/api/books?$filter=notin(pages,10,15)&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                    util.testBook(res.body.list[0],theBooks[1],authorOne);
                    util.testBook(res.body.list[1],theBooks[3],authorTwo);
                    done();
               });
    });

    it('and',function(done){
            api.get('/api/books?$filter=endswith(title,\'Book\') and genre eq \'Action\'&$orderby=title')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                    util.testBook(res.body.list[0],theBooks[0],authorOne);
                    util.testBook(res.body.list[1],theBooks[2],authorTwo);
                    done();
               });
    });

    // basic $filter through a relationship
    it('rel',function(done){
        api.get('/api/authors/'+authorOne._id+'/books?$filter=endswith(title,\'Book\') and genre eq \'Action\'&$orderby=title')
           .expect(200)
           .expect('Content-Type', /json/)
           .end(function(err,res) {
                if(err) {
                    return done(err);
                }
                res.body.should.be.instanceof(Object);
                res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                util.testBook(res.body.list[0],theBooks[0],authorOne);
                done();
           });
    });

    it('rel2',function(done){
        api.get('/api/authors/'+authorOne._id+'/books?$filter=endswith(title,\'Book\')&$orderby=title')
           .expect(200)
           .expect('Content-Type', /json/)
           .end(function(err,res) {
                if(err) {
                    return done(err);
                }
                res.body.should.be.instanceof(Object);
                res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                util.testBook(res.body.list[0],theBooks[1],authorOne);
                util.testBook(res.body.list[1],theBooks[0],authorOne);
                done();
           });
    });
});