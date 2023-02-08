var lastFrameTime = Date.now() / 1000;
var canvas, context;
var assetManager;
var skeleton, skeletonRenderer, state, bounds;

const path = 'assets/'	// Assets Folder with sk.json

function init () {
	canvas = document.getElementById("canvas");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	context = canvas.getContext("2d");
	// create renderer
	skeletonRenderer = new spine.canvas.SkeletonRenderer(context);
	// enable debug rendering
	skeletonRenderer.debugRendering = false;
	// enable the triangle renderer, supports meshes, but may produce artifacts in some browsers
	skeletonRenderer.triangleRendering = true;
	// Read sk.json
	$.ajaxSettings.async = false;
    $.getJSON(path+"sk.json",function(data){
		$('.temp').text(JSON.stringify(data))
    });
	// Preload assets from sk.json
	assetManager = new spine.canvas.AssetManager();
    skeletons = JSON.parse($('.temp').text())
	let keys = Object.keys(skeletons)
	keys.forEach(n => {skeletons[n].forEach(m =>{
		if (m['type']==='text'){assetManager.loadText(path+m["path"]);}
		if (m['type']==='bin'){assetManager.loadBinary(path+m["path"]);}
		if (m['type']==='atlas'){assetManager.loadTextureAtlas(path+m["path"]);}
	})});
	requestAnimationFrame(load);
}

function load () {
	// Wait until the AssetManager has loaded all resources, then load the skeletons.
	if (assetManager.isLoadingComplete()) {
		Object.keys(skeletons).forEach(n =>{
			skeletons[n]=loadSkeleton(skeletons[n])
		})
        activeSkeleton = Object.keys(skeletons)[0];
		setupUI();
		lastFrameTime = Date.now() / 1000;
        // Loading is done, call render every frame.
		requestAnimationFrame(render); 
	} else {requestAnimationFrame(load);}
}

function loadSkeleton (data) {
	var text,bin,atlas,skin,s;
	data.forEach(asset=>{
		if (asset['type']==='text'){text=asset['path']};
		if (asset['type']==='bin'){bin=asset['path']};
		if (asset['type']==='atlas'){atlas=path+asset['path']};
		if (asset['type']==='skin'){skin=path+asset['path']};
	})
	if (skin===undefined) skin = "default";
	// Load the texture atlas
	var atlasData = assetManager.get(atlas);
	// Create an AtlasAttachmentLoader that resolves region, mesh, boundingbox and path attachments
	var atlasLoader = new spine.AtlasAttachmentLoader(atlasData);
	// Create a skeleton loader instance for parsing the skeleton data file.
	if(bin!==undefined){s = path+bin;var skeletonLoader = new spine.SkeletonBinary(atlasLoader)} 
	else if(text!==undefined){s = path+text;var skeletonLoader = new spine.SkeletonJson(atlasLoader);}
	// Set the scale to apply during parsing, parse the file, and create a new skeleton.
	skeletonLoader.scale = -1;
	var skeletonData = skeletonLoader.readSkeletonData(assetManager.get(s));
	var skeleton = new spine.Skeleton(skeletonData);
	skeleton.setSkinByName(skin);
	var bounds = calculateBounds(skeleton);
	// Create an AnimationState, and set the initial animation in looping mode.
	var animationStateData = new spine.AnimationStateData(skeleton.data);
	var animationState = new spine.AnimationState(animationStateData);
    let initialAnimation = skeleton.data.animations[0].name
	animationState.setAnimation(0, initialAnimation, true);
	// Debug messages
	function log (message) {if ($('#debug').is(':checked')) console.log(message);}
	animationState.addListener({
		start: function(track) {log("Animation on track " + track.trackIndex + " started");},
		interrupt: function(track) {log("Animation on track " + track.trackIndex + " interrupted");},
		end: function(track) {log("Animation on track " + track.trackIndex + " ended");},
		disposed: function(track) {log("Animation on track " + track.trackIndex + " disposed");},
		complete: function(track) {log("Animation on track " + track.trackIndex + " completed");},
		event: function(track, event) {log("Event on track " + track.trackIndex + ": " + JSON.stringify(event));}
    })

	return { skeleton: skeleton, state: animationState, bounds: bounds, premultipliedAlpha: true };
}

function calculateBounds(skeleton) {
	skeleton.setToSetupPose();
	skeleton.updateWorldTransform();
	var offset = new spine.Vector2();
	var size = new spine.Vector2();
	skeleton.getBounds(offset, size, []);
	return { offset: offset, size: size };
}

function setupUI () {
    // handle skeleton list
	var skeletonList = $("#skeletonList");
	for (var skeletonName in skeletons) {
		var option = $("<option></option>");
		option.attr("value", skeletonName).text(skeletonName);
		if (skeletonName === activeSkeleton) option.attr("selected", "selected");
		skeletonList.append(option);
	}
	skeletonList.change(function() {
		activeSkeleton = $("#skeletonList option:selected").text();
		setupAnimationUI();
		setupSkinUI();
	})
    
    // handle animation list
	var setupAnimationUI = function() {
		var animationList = $("#animationList");
		animationList.empty();
		var skeleton = skeletons[activeSkeleton].skeleton;
		var state = skeletons[activeSkeleton].state;
		var activeAnimation = state.tracks[0].animation.name;
		for (var i = 0; i < skeleton.data.animations.length; i++) {
			var name = skeleton.data.animations[i].name;
			var option = $("<option></option>");
			option.attr("value", name).text(name);
			if (name === activeAnimation) option.attr("selected", "selected");
			animationList.append(option);
		}

		animationList.change(function() {
			var state = skeletons[activeSkeleton].state;
			var skeleton = skeletons[activeSkeleton].skeleton;
			var animationName = $("#animationList option:selected").text();
			skeleton.setToSetupPose();
			state.setAnimation(0, animationName, true);
		})
	}

    // handle skin list
	var setupSkinUI = function() {
		var skinList = $("#skinList");
		skinList.empty();
		var skeleton = skeletons[activeSkeleton].skeleton;
		var activeSkin = skeleton.skin == null ? "default" : skeleton.skin.name;
		for (var i = 0; i < skeleton.data.skins.length; i++) {
			var name = skeleton.data.skins[i].name;
			var option = $("<option></option>");
			option.attr("value", name).text(name);
			if (name === activeSkin) option.attr("selected", "selected");
			skinList.append(option);
		}

		skinList.change(function() {
			var skeleton = skeletons[activeSkeleton].skeleton;
			var skinName = $("#skinList option:selected").text();
			skeleton.setSkinByName(skinName);
			skeleton.setSlotsToSetupPose();
		})
	}

	setupAnimationUI();
	setupSkinUI();
}

function render () {
	var now = Date.now() / 1000;
	var delta = now - lastFrameTime;
	lastFrameTime = now;

	resize();

	context.save();
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.fillStyle = "#000000";
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.restore();

	
	var state = skeletons[activeSkeleton].state;
	var skeleton = skeletons[activeSkeleton].skeleton;
	state.update(delta);
	state.apply(skeleton);
	skeleton.updateWorldTransform();
	skeletonRenderer.draw(skeleton);

	context.strokeStyle = "green";
	context.beginPath();
	context.moveTo(-1000, 0);
	context.lineTo(1000, 0);
	context.moveTo(0, -1000);
	context.lineTo(0, 1000);
	context.stroke();

	requestAnimationFrame(render);
}

function resize () {
	var w = canvas.clientWidth;
	var h = canvas.clientHeight;
	if (canvas.width != w || canvas.height != h) {
		canvas.width = w;
		canvas.height = h;
	}

	var bounds = skeletons[activeSkeleton].bounds;
	// transform
	var centerX = bounds.offset.x + bounds.size.x / 2;
	var centerY = bounds.offset.y + bounds.size.y / 2;
	var scaleX = bounds.size.x / canvas.width;
	var scaleY = bounds.size.y / canvas.height;
	var scale = Math.max(scaleX, scaleY) * 1.2;
	if (scale < 1) scale = 1;
	var width = canvas.width * scale;
	var height = canvas.height * scale;
	
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.scale(1 / scale, 1 / scale);
	context.translate(-centerX, -centerY);
	context.translate(width / 2, height / 2);
}

init();
