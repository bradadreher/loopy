/**********************************

EDGE!

**********************************/

function Edge(model, config){

	var self = this;
	self._CLASS_ = "Edge";

	// Mah Parents!
	self.loopy = model.loopy;
	self.model = model;
	self.config = config;

	// Default values...
	_configureProperties(self, config, {
		from: _makeErrorFunc("CAN'T LEAVE 'FROM' BLANK"),
		to: _makeErrorFunc("CAN'T LEAVE 'TO' BLANK"),
		arc: 100,
		rotation: 0,
		strength: 1
	});

	// Get my NODES
	self.from = model.getNode(self.from);
	self.to = model.getNode(self.to);

	// We have signals!
	self.signals = [];
	self.signalSpeed = 0.02;
	self.addSignal = function(signal){

		// Re-create signal
		var delta = signal.delta;
		var age;
		if(signal.age===undefined){
			age = 12; // cos divisible by 1,2,3,4
		}else{
			age = signal.age-1;
		}
		var newSignal = {
			delta: delta,
			position: 0,
			scaleX: Math.abs(delta),
			scaleY: delta,
			age: age
		};

		// If it's expired, forget it.
		if(age<=0) return;

		self.signals.unshift(newSignal); // it's a queue!

	};
	self.updateSignals = function(){

		// Speed?
		self.signalSpeed = 7/self.getArrowLength();
		// TODO: Decide if this is the right idea???

		// Move all signals along
		for(var i=0; i<self.signals.length; i++){
			
			var signal = self.signals[i];
			var lastPosition = signal.position;
			signal.position += self.signalSpeed;

			// If crossed the 0.5 mark...
			if(lastPosition<0.5 && signal.position>=0.5){

				// Multiply by this edge's strength!
				signal.delta *= self.strength;

			}

			// And also TWEEN the scale.
			var gotoScaleX = Math.abs(signal.delta);
			var gotoScaleY = signal.delta;
			signal.scaleX = signal.scaleX*0.75 + gotoScaleX*0.25;
			signal.scaleY = signal.scaleY*0.75 + gotoScaleY*0.25;

		}

		// If any signals reach >=1, pass 'em along
		var lastSignal = self.signals[self.signals.length-1];
		while(lastSignal && lastSignal.position>=1){

			// Actually pass it along
			self.to.takeSignal(lastSignal);
			
			// Pop it, move on down
			self.signals.pop();
			lastSignal = self.signals[self.signals.length-1];

		}

	};
	self.drawSignals = function(ctx){
	
		// Draw each one
		for(var i=0; i<self.signals.length; i++){

			// Get position to draw at
			var signal = self.signals[i];
			var signalPosition = self.getPositionAlongArrow(signal.position);
			var signalX = signalPosition.x;
			var signalY = signalPosition.y;

			// Transform
			ctx.save();
			ctx.translate(signalX, signalY);
			ctx.rotate(-a);

			// Signal's direction & size
			var size = 40; // HARD-CODED
			ctx.scale(signal.scaleX, signal.scaleY);
			ctx.scale(size, size);

			// Signal's COLOR, BLENDING
			var fromColor = Node.COLORS[self.from.hue];
			var toColor = Node.COLORS[self.to.hue];
			var blend;
			var bStart=0.3, bEnd=0.7;
			if(signal.position<bStart){
				blend = 0;
			}else if(signal.position<bEnd){
				blend = (signal.position-bStart)/(bEnd-bStart);
			}else{
				blend = 1;
			}
			var signalColor = _blendColors(fromColor, toColor, blend);

			// Signal's age = alpha.
			if(signal.age==2){
				ctx.globalAlpha = 0.5;
			}else if(signal.age==1){
				ctx.globalAlpha = 0.25;
			}

			// Draw an arrow
			ctx.beginPath();
			ctx.moveTo(-2,0);
			ctx.lineTo(0,-2);
			ctx.lineTo(2,0);
			ctx.lineTo(1,0);
			ctx.lineTo(1,2);
			ctx.lineTo(-1,2);
			ctx.lineTo(-1,0);
			ctx.fillStyle = signalColor;
			ctx.fill();

			// Restore
			ctx.restore();

		}

	};
	self.clearSignals = function(){
		self.signals = [];
	};
	var _listenerReset = subscribe("model/reset", function(){
		self.clearSignals();
	});


	//////////////////////////////////////
	// UPDATE & DRAW /////////////////////
	//////////////////////////////////////

	// Update!
	self.labelX = 0;
	self.labelY = 0;
	var fx, fy, tx, ty,
		r, dx, dy, w, a, h,
		y, a2,
		arrowBuffer, arrowDistance, arrowAngle, beginDistance, beginAngle,
		startAngle, endAngle,
		y2, begin, end,
		arrowLength, ax, ay, aa,
		labelAngle, lx, ly, labelBuffer; // BECAUSE I'VE LOST CONTROL OF MY LIFE.
	self.update = function(speed){

		// When actually playing the simulation...
		/*if(self.loopy.mode==Loopy.MODE_PLAY){
			self.to.nextValue += self.from.value * self.strength * speed;
		}*/

		// Update signals
		self.updateSignals();

		////////////////////////////////////////////////
		// PRE-CALCULATE THE MATH (for retina canvas) //
		////////////////////////////////////////////////

		// Edge case: if arc is EXACTLY zero, whatever, add 0.1 to it.
		if(self.arc==0) self.arc=0.1;

		// Mathy calculations: (all retina, btw)
		fx=self.from.x*2;
		fy=self.from.y*2;
		tx=self.to.x*2;
		ty=self.to.y*2;	
		if(self.from==self.to){
			var rotation = self.rotation;
			rotation *= Math.TAU/360;
			tx += Math.cos(rotation);
			ty += Math.sin(rotation);
		}		
		dx = tx-fx;
		dy = ty-fy;
		w = Math.sqrt(dx*dx+dy*dy);
		a = Math.atan2(dy,dx);
		h = Math.abs(self.arc*2);

		// From: http://www.mathopenref.com/arcradius.html
		r = (h/2) + ((w*w)/(8*h));
		y = r-h; // the circle's y-pos is radius - given height.
		a2 = Math.acos((w/2)/r); // angle from x axis, arc-cosine of half-width & radius

		// Arrow buffer...
		arrowBuffer = 15;
		arrowDistance = (self.to.radius+arrowBuffer)*2;
		arrowAngle = arrowDistance/r; // (distance/circumference)*TAU, close enough.
		beginDistance = (self.from.radius+arrowBuffer)*2;
		beginAngle = beginDistance/r;

		// Arc it!
		startAngle = a2 - Math.TAU/2;
		endAngle = -a2;
		if(h>r){
			startAngle *= -1;
			endAngle *= -1;
		}
		if(self.arc>0){
			y2 = y;
			begin = startAngle+beginAngle;
			end = endAngle-arrowAngle;
		}else{
			y2 = -y;
			begin = -startAngle-beginAngle;
			end = -endAngle+arrowAngle;
		}

		// Arrow HEAD!
		arrowLength = 10*2;
		ax = w/2 + Math.cos(end)*r;
		ay = y2 + Math.sin(end)*r;
		aa = end + Math.TAU/4;

		// My label is...
		var s = self.strength;
		var l;
		if(s>=3) l="+++";
		else if(s>=2) l="++";
		else if(s>=1) l="+";
		else if(s==0) l="?";
		else if(s>=-1) l="-";
		else if(s>=-2) l="- -";
		else l="- - -";
		self.label = l;

		// Label position
		var labelPosition = self.getPositionAlongArrow(0.5);
		lx = labelPosition.x;
		ly = labelPosition.y;

		// ACTUAL label position, for grabbing purposes
		self.labelX = (fx + Math.cos(a)*lx - Math.sin(a)*ly)/2; // un-retina
		self.labelY = (fy + Math.sin(a)*lx + Math.cos(a)*ly)/2; // un-retina

		// ...add offset to label
		labelBuffer = 18*2; // retina
		if(self.arc<0) labelBuffer*=-1;
		ly += labelBuffer;

	};

	// Get position along arrow, on what parameter?
	self.getArrowLength = function(){
		var angle;
		if(self.from==self.to){
			angle = Math.TAU;
		}else{
			if(self.arc>0){
				angle = Math.abs(end-begin);
			}else{
				angle = Math.abs(-end+begin); // i dunno why this works but it does
			}
		}
		return r*angle;
	};
	self.getPositionAlongArrow = function(param){

		// If the arc's circle is actually BELOW the line...
		var begin2 = begin;
		if(y<0){
			// DON'T KNOW WHY THIS WORKS, BUT IT DOES.
			if(begin2>0){
				begin2-=Math.TAU;
			}else{
				begin2+=Math.TAU;
			}
		}

		// Get angle!
		var angle = begin2 + (end-begin2)*param;
		
		// return x & y
		return{
			x: w/2 + Math.cos(angle)*r,
			y: y2 + Math.sin(angle)*r
		};

	};

	// Draw
	self.draw = function(ctx){

		// Width & Color
		ctx.lineWidth = 4*Math.abs(self.strength)-2;
		ctx.strokeStyle = "#000";

		// Translate & Rotate!
		ctx.save();
		ctx.translate(fx, fy);
		ctx.rotate(a);

		// Arc it!
		ctx.beginPath();
		if(self.arc>0){
			ctx.arc(w/2, y2, r, startAngle, end, false);
		}else{
			ctx.arc(w/2, y2, r, -startAngle, end, true);
		}

		// Arrow HEAD!
		ctx.save();
		ctx.translate(ax, ay);
		if(self.arc<0) ctx.scale(-1,-1);
		ctx.rotate(aa);
		ctx.moveTo(-arrowLength, -arrowLength);
		ctx.lineTo(0,0);
		ctx.lineTo(-arrowLength, arrowLength);
		ctx.restore();

		// Stroke!
		ctx.stroke();

		// Draw label!
		ctx.font = "100 40px sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.save();
		ctx.translate(lx, ly);
		ctx.rotate(-a);
		ctx.fillText(self.label, 0, 0);
		ctx.restore();

		// DRAW SIGNALS
		self.drawSignals(ctx);

		// Restore
		ctx.restore();

	};

	//////////////////////////////////////
	// KILL EDGE /////////////////////////
	//////////////////////////////////////

	self.kill = function(){

		// Kill Listeners!
		unsubscribe("model/reset",_listenerReset);

		// Remove from parent!
		model.removeEdge(self);

		// Killed!
		publish("kill",[self]);

	};

	//////////////////////////////////////
	// HELPER METHODS ////////////////////
	//////////////////////////////////////

	self.isPointOnLabel = function(x, y){
		return _isPointInCircle(x, y, self.labelX, self.labelY, 40);
	};


}