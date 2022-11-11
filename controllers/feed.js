const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');

const User = require('../models/user');
const Post = require('../models/post');
const { count } = require('console');

exports.getPosts = async (req, res, next) => {
    const currentPage = req.query.page || 1;
    const perPage = 2;
    let totalItems;
    try {
        totalItems = await Post.find().countDocuments();
        const posts = await Post.find().populate('creator').skip((currentPage - 1) * perPage).limit(perPage);
        res.status(200).json({
            message: 'Posts found!',
            posts: posts,
            totalItems: totalItems
        });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 404;
        }
        next(err);
    }
};

exports.postPost = async (req, res, next) => {
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
    try {
        const imageURL = req.file.path.replace("\\", "/");    //Doesn't need replace if on Linux or MacOS
        const title = req.body.title;
        const content = req.body.content;
        const post = new Post({
            title: title,
            content: content,
            imageURL: imageURL,
            creator: req.userId
        });
        await post.save();
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('User not found!');
            error.statusCode = 404;
            throw error;
        }
        user.posts.push(post);
        await user.save();
        res.status(201).json({
            message: 'Post created successfully',
            post: post,
            creator: {
                _id: user._id,
                name: user.name
            }
        });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

exports.getPost = async (req, res, next) => {
    const postId = req.params.postId;
    try {
        const post = await Post.findById(postId).populate('creator');
        if (!post) {
            const error = new Error('Post not found!');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            message: 'Post fetched!',
            post: post
        });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 404;
        }
        next(err);
    }
};

exports.updatePost = async (req, res, next) => {
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
    try {
        const post = await Post.findById(postId);
        if (!post) {
            const error = new Error('Post not found!');
            error.statusCode = 404;
            throw error;
        }
        if (post.creator.toString() !== req.userId) {
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
        await post.save();
        res.status(200).json({ message: 'Post updated!', post: post });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

exports.deletePost = async (req, res, next) => {
    const postId = req.params.postId;
    try {
        const post = await Post.findById(postId);
        if (!post) {
            const error = new Error('Post not found!');
            error.statusCode = 404;
            throw error;
        }
        //Check if userId matches the creator of post
        if (post.creator.toString() !== req.userId) {
            const error = new Error('Not authorized!');
            error.statusCode = 403;
            throw error;
        }
        clearImage(post.imageURL);
        await Post.findByIdAndRemove(postId);
        await User.updateOne({ _id: req.userId }, { $pull: { posts: postId } });
        res.status(200).json({ message: 'Post Deleted!' });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    };
};

exports.getStatus = async (req, res, next) => {
    const userId = req.userId;
    try {
        const user = await User.findById(userId);
        res.status(200).json({ message: 'User status fetched', status: user.status });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 404;
        }
        next(err);
    };
};

exports.updateStatus = async (req, res, next) => {
    const userId = req.userId;
    try {
        const newStatus = req.body.status;
        const user = await User.findById(userId);
        if(!user){
            const error = new Error('User not found!');
            error.statusCode = 404;
            throw error; 
        }
        user.status = newStatus;
        user.save();
        res.status(200).json({ message: 'Status Updated!', status: newStatus });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    };
};

const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => {
        console.log(err);
    })
};