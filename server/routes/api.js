// add this to server.js:
// app.use('/api', apiRouter);

// var apiRouter = express.Router();
var helper = require('../app/helpers/helpers');
var api = require('request-promise');
var Coder = require('../app/models/coder');
var Coders = require('../app/collections/coders');

module.exports = function (app) {

	// should be called with the following endpoint syntax: GET /api/realtime?u={username}
	app.get('/realtime', function(req, res, next) {
		console.log('/realtime route hit');
		var coder = {};
		var token = "<get from Evernote>"; // do not upload to GitHub with this token assigned explicitly!
		var options = {
			url: 'https://api.github.com/users/',
			headers: {
				'User-Agent': 'CodeUs-App',
				'Authorization': 'token '+ token 
			}
		};
		options.url += req.query.u;
		// fetch real-time user attr from API, assign to empty coder object
		api(options)
		.then(function(response) {
			var parsed = JSON.parse(response);
			coder.followers = parsed.followers;
			coder.updated_at = parsed.updated_at;
			coder.repo_count = parsed.public_repos;
			coder.gh_username = req.query.u;
		})
		// fetch rest of the data from the database
		.then(function() {
			new Coder({'gh_username': req.query.u})
			.fetch()
			.then(function(userModel) {
				if (!userModel) {
					console.log('User model ' + req.query.u + ' not found');
				} else {
					coder.name = userModel.attributes.name;
					coder.location = userModel.attributes.location;
					coder.email = userModel.attributes.email;
					coder.gh_site_url = userModel.attributes.blog;
					coder.photo_url = userModel.attributes.avatar_url;
					coder.gh_member_since = userModel.attributes.created_at;
					coder.so_reputation = userModel.attributes.so_reputation;
					coder.so_answer_count = userModel.attributes.so_answer_count;
					coder.so_question_count = userModel.attributes.so_question_count;
					coder.so_upvote_count = userModel.attributes.so_upvote_count;
					res.status(200).send(coder);
				}
			});
		});
	});

	app.get('/addsodata', function(req, res, next) {
		// console.log('/addsodata route hit');
		var pageNumber = 1;
		var hasMore = true;
		var quotaRemain = 10;
		var options = {
			url: 'https://api.stackexchange.com/2.2/users?pagesize=100&order=desc&sort=reputation&site=stackoverflow&filter=!Ln4IB)_.hsRjrBGzKe*i*W&page=' + pageNumber,
			gzip: true
		};
		// while (quotaRemain > 5 && hasMore === true) {
			// console.log('/addsodata while loop entered');
			// console.log('link', options.url);
			api(options)
			.then(function(response) {
				// console.log('response', response);
				var parsed = JSON.parse(response);
				// console.log('parsed', parsed);
				pageNumber++;
				hasMore = parsed.has_more;
				// console.log('parsed.has_more', parsed.has_more);
				quotaRemain = parsed.quota_remaining;
				// console.log('parsed.quota_remaining', parsed.quota_remaining);
				parsed.items.forEach(function(user, i, items) {
					// console.log('index', i, 'user', user);
					new Coder({'name': user.display_name}).fetch()
					.then(function(userModel) {
						if (!userModel) {
							// console.log('No user named ' + user.display_name + ' among GH users in DB.');
						} else {
							userModel.save({
								so_location: user.location,
								so_name: user.display_name,
      					so_member_since: user.creation_date,
      					so_reputation: user.reputation,
      					so_answer_count: user.answer_count,
      					so_question_count: user.question_count,
      					so_upvote_count: user.up_vote_count,
      					so_site_url: user.website_url
							});
						}
					});
				});
			});
		// }
	});

	app.get('/populate', function(req, res, next) {
		console.log('/populate route hit');
		var token = "88a060383b6649c35278dd71db147f8a05cc8ea1"; // do not upload to GitHub with this token assigned explicitly!
		var since = 0;
		var full = true;
		var options = {
			url: 'https://api.github.com/users?per_page=100',
			headers: {
				'User-Agent': 'CodeUs-App',
				'Authorization': 'token '+ token 
			}
		};
		console.log('full: ', full);
		// fetch users from GET /users call, save to db
		while (full == true) {
			console.log('while loop entered');
			console.log('options: ', options);
			api(options)
			.then(function(response) {
				var parsed = JSON.parse(response);
				console.log('full parsed', parsed);
				if (parsed.length < 100) { full = false;}
				for (var i=0; i < parsed.length; i++) {
					since = parsed[i].id;
					console.log('record ' + since + ': ' + parsed[i]);
					new Coder({gh_username: parsed.login}).fetch()
	    			.then(function(coder) {
	    				if (coder) {
	    					console.log('existing coder: ', coder.gh_username);
				      	coder.save({
				      		gh_username: parsed[i].login,
									name: parsed[i].name,
									location: parsed[i].location,
									email: parsed[i].email,
									gh_site_url: parsed[i].blog,
									photo_url: parsed[i].avatar_url,
									gh_member_since: parsed[i].created_at
				      	});
	    				} else {
	    					var newCoder = new Coder({
				      		gh_username: parsed[i].login,
									name: parsed[i].name,
									location: parsed[i].location,
									email: parsed[i].email,
									gh_site_url: parsed[i].blog,
									photo_url: parsed[i].avatar_url,
									gh_member_since: parsed[i].created_at	    						
	    					});
	    					newCoder.save()
	    						.then(function(coder) {
        						Coders.set(coder);
      						});
			      	console.log('Coder ' + parsed[i].name + ' added to DB');
						}
					});
			options.url = 'https://api.github.com/users?per_page=100&since=' + since;
			}
		})
		.catch(console.error);
   }
	});
};
