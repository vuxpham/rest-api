const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');

const User = require('../models/user');
const Post = require('../models/post');
const { count } = require('console');

exports.getPosts = (req, res, next) => {
    const currentPage = req.query.page || 1;
    const perPage = 2;
    let totalItems;
    Post.find()
        .countDocuments()
        .then(count => {
            totalItems = count;
            return Post.find()
                .skip((currentPage - 1) * perPage)
                .limit(perPage);
        })
        .then(posts => {
            res.status(200).json({
                message: 'Posts found!',
                posts: posts,
                totalItems: totalItems
            });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 404;
            }
            next(err);
        });
};

exports.postPost = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed, entered data is incorrect!');
        error.statusCode = 422;
        throw error;
    }
    if (!req.file) {
        const error = new Error('No image provided!');
        error.statusCode = 422;
        throw error;
    }
    let creator;
    const imageURL = req.file.path.replace("\\", "/");    //Doesn't need replace if on Linux or MacOS
    const title = req.body.title;
    const content = req.body.content;
    const post = new Post({
        title: title,
        content: content,
        imageURL: imageURL,
        creator: req.userId
    });
    post
        .save()
        .then(result => {
            return User.findById(req.userId);
        })
        .then(user => {
            creator = user;
            user.posts.push(post);
            return user.save();
        })
        .then(result => {
            res.status(201).json({
                message: 'Post created successfully',
                post: post,
                creator: {
                    _id: creator._id, 
                    name: creator.name
                }
            });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};

exports.getPost = (req, res, next) => {
    const postId = req.params.postId;
    Post.findById(postId)
        .then(post => {
            if (!post) {
                const error = new Error('Post not found!');
                error.statusCode = 404;
                throw error;
            }
            res.status(200).json({
                message: 'Post fetched!',
                post: post
            });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};

exports.updatePost = (req, res, next) => {
    const postId = req.params.postId;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed, entered data is incorrect!');
        error.statusCode = 422;
        throw error;
    }
    const title = req.body.title;
    const content = req.body.content;
    let imageURL = req.body.image;
    if (req.file) {
        imageURL = req.file.path.replace("\\", "/");
    }
    if (!imageURL) {
        const error = new Error('No file picked!');
        error.statusCode = 422;
        throw error;
    }
    //WHEN PASS ALL VALIDATIONS
    Post.findById(postId)
        .then(post => {
            if (!post) {
                const error = new Error('Post not found!');
                error.statusCode = 404;
                throw error;
            }
            if(post.creator.toString() !== req.userId){
                const error = new Error('Not authorized!');
                error.statusCode = 403;
                throw error;
            }
            if (imageURL !== post.imageURL) {
                clearImage(post.imageURL);
            }
            post.title = title;
            post.content = content;
            post.imageURL = imageURL;
            return post.save();
        })
        .then(result => {
            res.status(200).json({ message: 'Post updated!', post: result });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};

exports.deletePost = (req, res, next) => {
    const postId = req.params.postId;
    Post.findById(postId)
        .then(post => {
            if (!post) {
                const error = new Error('Post not found!');
                error.statusCode = 404;
                throw error;
            }
            //Check if userId matches the creator of post
            if(post.creator.toString() !== req.userId){
                const error = new Error('Not authorized!');
                error.statusCode = 403;
                throw error;
            }
            clearImage(post.imageURL);
            return Post.findByIdAndRemove(postId);
        })
        .then(result => {
            return User.updateOne({_id: req.userId}, {$pull: {posts: postId}});
        })
        .then(result => {
            res.status(200).json({ message: 'Post Deleted!' });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};

exports.getStatus = (req, res, next) => {
    const userId = req.userId;
    User.findById(userId)
        .then(user => {
            res.status(200).json({message: 'User status fetched', status: user.status});
        })
        .catch(err => {
            if(!err.statusCode){
                err.statusCode = 404;
            }
            next(err);
        });
};

exports.updateStatus = (req, res, next) => {
    const userId = req.userId;
    const newStatus = req.body.status;
    User.findById(userId)
        .then(user => {
            user.status = newStatus;
            return user.save();
        })
        .then(result => {
            res.status(200).json({message: 'Status Updated!', status: newStatus});
        })
        .catch(err => {
            if(!err.statusCode){
                err.statusCode = 500;
            }
            next(err);
        });
};

const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => {
        console.log(err);
    })
};