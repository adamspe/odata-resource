var mongoose = require('mongoose');

module.exports = {
    Author: mongoose.model('Author',{
        firstname: String,
        lastname: String
    }),
    Book: mongoose.model('Book',{
        title: String,
        _author: {type: mongoose.Schema.Types.ObjectId, ref: 'Author'},
        genre: String
    }),
    Review: mongoose.model('Review',{
        _book: mongoose.Schema.Types.ObjectId,
        content: String,
        stars: Number
    })
};