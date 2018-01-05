var mongoose = require('mongoose');

module.exports = {
    Author: mongoose.model('Author',{
        firstname: { type: String, required: true, trim: true },
        lastname: { type: String, required: true, trim: true },
        middlename: { type: String, required: false, trim: true }
    }),
    Book: mongoose.model('Book',{
        title: { type: String, required: true, trim: true },
        _author: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Author'},
        genre: { type: String, required: true, trim: true },
        pages: { type: Number, required: false, min: 1 },
        release: { type: Date, required: false }
    }),
    Review: mongoose.model('Review',{
        _book: {type: mongoose.Schema.Types.ObjectId, required: true},
        content: { type: String, required: true, trim: true },
        stars: { type: Number, required: true, min: 1, max: 5 },
        updated: { type: Date, default: Date.now }
    })
};
