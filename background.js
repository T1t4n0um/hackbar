/**
When we receive the message, execute the given script in the given
tab.
*/
var url;
var refrerrer;
var user_agent;
var cookie;
var method;

function getCurrentTabUrl(sendResponse){
	browser.tabs.query({active:true, currentWindow:true}).then(tabs => {
		currentTabUrl = tabs[0].url;
		sendResponse({url: currentTabUrl});
	});
}
function isExistHeaders(name, requestHeaders){
	for(i=0; i< requestHeaders.length; i++){
		var v = requestHeaders[i];
		if(v.name.toLowerCase() === name){
			return i;
		}
	}
	return -1;
}
function rewriteHeaders(e) {
	//add referer
	if(refrerrer){
		index_referer = isExistHeaders('referer', e.requestHeaders);
		if(index_referer != -1){
			e.requestHeaders[index_referer].value = refrerrer;
		}else{
			e.requestHeaders.push({
				name: "Referer",
				value: refrerrer
			});
		}
	}
	//modify user agent
	if(user_agent){
		index_user_agent = isExistHeaders('user-agent', e.requestHeaders);
		if(index_user_agent != -1){
			e.requestHeaders[index_user_agent].value = user_agent;
		}else{
			e.requestHeaders.push({
				name: "User-Agent",
				value: user_agent
			});
		}
	}
	//modify cookie
	if(cookie){
		index_cookie = isExistHeaders('cookie', e.requestHeaders);
		if(index_cookie != -1){
			e.requestHeaders[index_cookie].value = cookie;
		}else{
			e.requestHeaders.push({
				name: "Cookie",
				value: cookie
			});
		}
	}
	browser.webRequest.onBeforeSendHeaders.removeListener(rewriteHeaders);
	return {requestHeaders: e.requestHeaders};
}

function handleMessage(request, sender, sendResponse) {
	if (sender.url !== browser.runtime.getURL("/theme/hackbar-panel.html")) {
		return;
	}
	var tabId = request.tabId;
	var action = request.action;
	switch(action){
		case 'send_requests':
			url = request.url;
			method = request.method;
			refrerrer = request.refrerrer;
			user_agent = request.user_agent;
			cookie = request.cookie;
			content_type = request.content_type;
			if(method == 'GET'){
				browser.tabs.update({url: url});
			}else{
				var post_data = request.data;
				var content_type = request.content_type;
				if(content_type == 'application/x-www-form-urlencoded'){
					browser.tabs.executeScript(tabId, {code: 'var post_data = "'+ escape(post_data) +'"; var url = "'+ escape(url) +'"'}, function(){
						browser.tabs.executeScript(tabId, {file: 'theme/js/post_form.js'});
					});
				}else{
					var myHeaders = new Headers();
					myHeaders.append("Content-Type", content_type);
					myHeaders.append("Cache", "no-cache");
					if(refrerrer){
						myHeaders.append("Referer", refrerrer);
					}
					if(user_agent){
						myHeaders.append("User-Agent", user_agent);
					}
					if(cookie){
						myHeaders.append("Cookie", cookie);
					}
					fetch(url, {
						method: "POST",
						redirect: 'follow',
						headers: myHeaders,
						credentials: 'include',
						body: post_data
					}).then(function(response) {
						response.text().then(function (responsePost) {
							var code = 'document.body.innerHTML = (unescape("'+ escape(responsePost) +'"));';
							browser.tabs.executeScript({code: code});
						});
					});
				}
			}
			browser.webRequest.onBeforeSendHeaders.addListener(
				rewriteHeaders,
				{urls: ["<all_urls>"], types: ["main_frame"]},
				["blocking", "requestHeaders"]
			);
			sendResponse({status: true});
			break;
		case 'load_url':
			getCurrentTabUrl(sendResponse);
			break;
		case 'selected_text':
			var code = 'alert( "No text was selected for this action");';
			browser.tabs.executeScript({code: code});
			break;
	}
	return true;
}

/**
Listen for messages from our devtools panel.
*/
browser.runtime.onMessage.addListener(handleMessage);