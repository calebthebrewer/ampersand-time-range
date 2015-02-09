;(function() {
  var d3 = require('d3');
  var _ = require('lodash');

  var AmpersandState = require('ampersand-state');
  var AmpersandView = require('ampersand-view');

  var TimeRangeState = AmpersandState.extend({
    session: {
      startX: [ 'number', false , 0 ],
      endX: [ 'number', false, -1 ],
      width: 'number'
    },
    derived: {
      startTime: {
        deps: [ 'startX' ],
        fn: function() {
          return typeof this.width === 'number' ? this.map(this.startX, 0, this.width, 0, 1440) : 0;
        }
      },
      endTime: {
        deps: [ 'endX' ],
        fn: function() {
          return this.endX === -1 ? 1440 : this.map(this.endX, 0, this.width, 0, 1440);
        }
      }
    },
    map: function(s, a1, a2, b1, b2) {
      return Math.round(b1 + (s - a1) * (b2 - b1) / (a2 - a1));
    },
    intToTimeString: function(s) {
      var hours = Math.floor(s / 60);
      var minutes = s % 60;
      var meridian = s / 60 >= 12 && s !== 1440 ? 'pm' : 'am';

      return (hours % 12 !== 0 ? hours % 12 : 12) + ':' + (minutes > 9 ? minutes : '0' + minutes) + ' ' + meridian;
    }
  });

  var TimeRangeView = AmpersandView.extend({
    template: '<svg></svg>',
    autoRender: true,
    initialize: function() {
      this.model._view = this;
    },
    bindings: {
      'model.startX': {
        type: function(el, startX) {
          if (this.svg) {
            this.svg.select('circle.ampersand-time-range-handle-start')
              .attr('cx', startX);
            this.resizeDuration();
          }
        }
      },
      'model.endX': {
        type: function(el, endX) {
          if (this.svg) {
            this.svg.select('circle.ampersand-time-range-handle-end')
              .attr('cx', endX);
            this.resizeDuration();
          }
        }
      }
    },
    render: function() {
      AmpersandView.prototype.render.call(this);

      var range = this.svg = d3.select(this.el)
        .attr('class', 'ampersand-time-range')
        .style('overflow', 'visible')
        .attr('width', '100%')
        .attr('height', '3em');

      var leftMidnight = range.append('text')
        .attr('class', 'ampersand-time-range-midnight ampersand-time-range-midnight-left')
        .attr('x', '0')
        .attr('y', '1.5em')
        .text('12 am');

      var rightMidnight = range.append('text')
        .attr('class', 'ampersand-time-range-midnight ampersand-time-range-midnight-right')
        .attr('x', '100%')
        .attr('y', '1.5em')
        .text('12 am');

      var noon = range.append('text')
        .attr('class', 'ampersand-time-range-midnight ampersand-time-range-noon')
        .attr('x', '50%')
        .attr('y', '1.5em')
        .text('12 pm');

      var bar = range.append('rect')
        .attr('class', 'ampersand-time-range-bar')
        .attr('x', '0')
        .attr('y', '2em')
        .attr('width', '100%')
        .attr('height', '0.5em')
        .attr('rx', '0.25em')
        .attr('ry', '0.25em');

      var durationBar = range.append('line')
        .attr('class', 'ampersand-time-range-duration')
        .attr('x1', '0')
        .attr('y1', '2.25em')
        .attr('x2', '100%')
        .attr('y2', '2.25em');

      var handleStartDrag = d3.behavior.drag()
        .on('dragstart', function(d) {
          d.view.showToolTip(d.model.startX);
        })
        .on('drag', function(d, i) {
          var bar = d.view.svg.select('rect.ampersand-time-range-bar')[0][0];
          d.model.width = bar.getBBox().width;
          d.model.endX = d.model.endX > -1 ? d.model.endX : d.model.width;
          d.x = Math.max(0, d3.mouse(bar)[0]);
          d.x = Math.min(d.x, d.model.endX);
          d.model.startX = d.x;
          d.view.setToolTip(d.model.startX, d.model.startTime);
        })
        .on('dragend', function(d, i) {
          d.view.hideToolTip();
        });

      var handleStart = range.append('circle')
        .data([{ x: 0, model: this.model, view: this }])
        .attr('class', 'ampersand-time-range-handle ampersand-time-range-handle-start')
        .attr('cy', '2.25em')
        .attr('cx', '0')
        .attr('r', '0.5em')
        .call(handleStartDrag);

      var handleEndDrag = d3.behavior.drag()
        .on('dragstart', function(d) {
          d.view.showToolTip(d.model.endX);
        })
        .on('drag', function(d, i) {
          var bar = d.view.svg.select('rect.ampersand-time-range-bar')[0][0];
          d.model.width = bar.getBBox().width;
          d.x = Math.min(d.model.width, d3.mouse(bar)[0]);
          d.x = Math.max(d.x, d.model.startX);
          d.model.endX = d.x;
          d.view.setToolTip(d.model.endX, d.model.endTime);
        })
        .on('dragend', function(d, i) {
          d.view.hideToolTip();
        });

      var handleEnd = range.append('circle')
        .data([{ x: 0, model: this.model, view: this }])
        .attr('class', 'ampersand-time-range-handle ampersand-time-range-handle-end')
        .attr('cy', '2.25em')
        .attr('cx', '100%')
        .attr('r', '0.5em')
        .call(handleEndDrag);

      var toolTip = range.append('g')
        .attr('class', 'ampersand-time-range-tool-tip')
        .style('opacity', 0);
      
      var toolTipRect = toolTip.append('rect')
        .attr('class', 'ampersand-time-range-tool-tip-rect')
        .attr('width', '4em')
        .attr('height', '1.5em');

      var toolTipTail = toolTip.append('polygon')
        .attr('class', 'ampersand-time-range-tool-tip-tail')
        .attr('points', '0, 0 20, 0 10, 10')
        .attr('transform', 'translate(22, 23)');

      var toolTipText = toolTip.append('text')
        .attr('class', 'ampersand-time-range-tool-tip-text')
        .attr('x', '2.6em')
        .attr('y', '1.35em')
        .text('2:15 pm');
    },
    showToolTip: function(x) {
      this.svg.select('g.ampersand-time-range-tool-tip')
        .attr('transform', 'translate(' + (x - 32) + ', -10)')
        .transition()
        .style('opacity', 1);
    },
    setToolTip: function(x, t) {
      this.svg.select('g.ampersand-time-range-tool-tip')
        .attr('transform', 'translate(' + (x - 32) + ', -10)');

      this.svg.select('text.ampersand-time-range-tool-tip-text')
        .text(this.model.intToTimeString(t));
    },
    hideToolTip: function() {
      this.svg.select('g.ampersand-time-range-tool-tip')
        .transition()
        .duration(2000)
        .style('opacity', 0);
    },
    resizeDuration: function() {
      this.svg.select('line.ampersand-time-range-duration')
        .attr('x1', this.model.startX)
        .attr('x2', this.model.endX);
    }
  });

  module.exports = {
    State: TimeRangeState,
    View: TimeRangeView
  };
})();
