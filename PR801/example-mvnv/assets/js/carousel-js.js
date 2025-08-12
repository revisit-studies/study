class Carousel {
    constructor(selector) {
      this._clickEvents = ['touchstart', 'click'];
  
      this.carousel = typeof selector === 'string' ? document.querySelector(selector) : selector;
      // An invalid selector or non-DOM node has been provided.
      if (!this.carousel) {
        throw new Error('An invalid selector or non-DOM node has been provided.');
      }
  
      this.init();
    }
  
    /**
     * Initiate all DOM element containing carousel class
     * @method
     * @return {Array} Array of all Carousel instances
     */
    static attach() {
      let carouselInstances = [];
  
      const carousels = document.querySelectorAll('.carousel, .hero-carousel');
      [].forEach.call(carousels, (carousel) => {
        setTimeout(() => {
          carouselInstances.push(new Carousel(carousel));
        }, 100);
      });
      return carouselInstances;
    }
  
    /**
     * Initiate plugin
     * @method init
     * @return {void}
     */
    init() {
      this.computedStyle = window.getComputedStyle(this.carousel);
  
      this.carouselContainer = this.carousel.querySelector('.carousel-container');
      this.carouselItems = this.carousel.querySelectorAll('.carousel-item');
      this.carouselItemsArray = Array.from(this.carouselItems);
  
      // Detect which animation is setup and auto-calculate size
      if (this.carousel.dataset.size && !this.carousel.classList.contains('carousel-animate-fade')) {
        this.carouselWidth = parseInt(this.computedStyle.getPropertyValue('width'), 10);
        this.offset = this.carouselWidth / this.carousel.dataset.size;
        this.carouselContainer.style.left = 0 - this.offset + 'px';
        this.carouselContainer.style.transform = `translateX(${this.offset}px)`;
        [].forEach.call(this.carouselItems, (carouselItem) => {
          carouselItem.style.flexBasis = `${this.offset}px`;
        });
      }
  
      // If animation is fade then force carouselContainer size (due to the position: absolute)
      if (this.carousel.classList.contains('carousel-animate-fade') && this.carouselItems.length) {
        let img = this.carouselItems[0].querySelector('img');
        img.onload = () => {
          this.carouselContainer.style.height = img.naturalWidth+ 'px';
        };
      }
  
      this._initNavigation();
  
      this.currentItem = {
        node: null,
        pos: -1
      };
      this.currentItem.node = this.carousel.querySelector('.carousel-item.is-active'),
      this.currentItem.pos = this.currentItem.node ? this.carouselItemsArray.indexOf(this.currentItem.node) : -1;
      if (!this.currentItem.node) {
        this.currentItem.node = this.carouselItems[0];
        this.currentItem.node.classList.add('is-active');
        this.currentItem.pos = 0;
      }
  
      this._setOrder();
  
      if (this.carousel.dataset.autoplay && this.carousel.dataset.autoplay == 'true') {
        this._autoPlay(this.carousel.dataset.delay || 5000);
      }
  
      this._bindEvents();
    }
  
    /**
     * Initiate Navigation area and Previous/Next buttons
     * @method _initNavigation
     * @return {[type]}        [description]
     */
    _initNavigation() {
      this.previousControl = this.carousel.querySelector('.carousel-nav-left');
      this.nextControl = this.carousel.querySelector('.carousel-nav-right');
  
      if (this.carouselItems.length <= 1) {
        if (this.carouselContainer) {
          this.carouselContainer.style.left = '0';
        }
        if (this.previousControl) {
          this.previousControl.style.display = 'none';
        }
        if (this.nextControl) {
          this.nextControl.style.display = 'none';
        }
      }
    }
  
    /**
     * Bind all events
     * @method _bindEvents
     * @return {void}
     */
    _bindEvents() {
      if (this.previousControl) {
        this._clickEvents.forEach((clickEvent) => {
          this.previousControl.addEventListener(clickEvent, (e) => {
            e.preventDefault();
            this._slide('previous');
            if (this._autoPlayInterval) {
              clearInterval(this._autoPlayInterval);
              this._autoPlay(this.carousel.dataset.delay || 5000);
            }
          });
        });
      }
  
      if (this.nextControl) {
        this._clickEvents.forEach((clickEvent) => {
          this.nextControl.addEventListener(clickEvent, (e) => {
            e.preventDefault();
            this._slide('next');
            if (this._autoPlayInterval) {
              clearInterval(this._autoPlayInterval);
              this._autoPlay(this.carousel.dataset.delay || 5000);
            }
          });
        });
      }
  
      // Bind swipe events
      this.carousel.addEventListener('touchstart', (e) => {
        this._swipeStart(e);
      });
      this.carousel.addEventListener('mousedown', (e) => {
        this._swipeStart(e);
      });
  
      this.carousel.addEventListener('touchend', (e) => {
        this._swipeEnd(e);
      });
      this.carousel.addEventListener('mouseup', (e) => {
        this._swipeEnd(e);
      });
    }
  
    /**
     * Find next item to display
     * @method _next
     * @param  {Node} element Current Node element
     * @return {Node}         Next Node element
     */
    _next(element) {
      if (element.nextElementSibling) {
        return element.nextElementSibling;
      } else {
        return this.carouselItems[0];
      }
    }
  
    /**
     * Find previous item to display
     * @method _previous
     * @param  {Node}  element Current Node element
     * @return {Node}          Previous Node element
     */
    _previous(element) {
      if (element.previousElementSibling) {
        return element.previousElementSibling;
      } else {
        return this.carouselItems[this.carouselItems.length - 1];
      }
    }
  
    /**
     * Update each item order
     * @method _setOrder
     */
    _setOrder() {
      this.currentItem.node.style.order = '1';
      this.currentItem.node.style.zIndex = '1';
      let item = this.currentItem.node;
      let i, j, ref;
      for (i = j = 2, ref = this.carouselItemsArray.length; (2 <= ref ? j <= ref : j >= ref); i = 2 <= ref ? ++j : --j) {
        item = this._next(item);
        item.style.order = '' + i % this.carouselItemsArray.length;
        item.style.zIndex = '0';
      }
    }
  
    /**
     * Save current position on start swiping
     * @method _swipeStart
     * @param  {Event}    e Swipe event
     * @return {void}
     */
    _swipeStart(e) {
      this._touch = {
        start: {
          x: e.clientX,
          y: e.clientY
        },
        end: {
          x: e.clientX,
          y: e.clientY
        }
      };
    }
  
    /**
     * Save current position on end swiping
     * @method _swipeEnd
     * @param  {Event}  e swipe event
     * @return {void}
     */
    _swipeEnd(e) {
      this._touch.end = {
        x: e.clientX,
        y: e.clientY
      };
  
      this._handleGesture();
    }
  
    /**
     * Identify the gestureand slide if necessary
     * @method _handleGesture
     * @return {void}
     */
    _handleGesture() {
      const ratio = {
        horizontal: (this._touch.end.x - this._touch.start.x) / parseInt(this.computedStyle.getPropertyValue('width')),
        vertical: (this._touch.end.y - this._touch.start.y) / parseInt(this.computedStyle.getPropertyValue('height'))
      };
  
      if (ratio.horizontal > ratio.vertical && ratio.horizontal > 0.25) {
        this._slide('previous');
      }
  
      if (ratio.horizontal < ratio.vertical && ratio.horizontal < -0.25) {
        this._slide('next');
      }
    }
  
    /**
     * Update slides to display the wanted one
     * @method _slide
     * @param  {String} [direction='next'] Direction in which items need to move
     * @return {void}
     */
    _slide(direction = 'next') {
      if (this.carouselItems.length) {
        // Disable transition to instant change order
        this.carousel.classList.remove('carousel-animated');
        //this.emit('carousel:slide:before', this.currentItem);
        this.currentItem.node.classList.remove('is-active');
        // initialize direction to change order
        if (direction === 'previous') {
          this.currentItem.node = this._previous(this.currentItem.node);
          // add reverse class
          if (!this.carousel.classList.contains('carousel-animate-fade')) {
            this.carousel.classList.add('is-reversing');
            this.carouselContainer.style.transform = `translateX(${-Math.abs(this.offset)}px)`;
          }
        } else {
          // Reorder items
          this.currentItem.node = this._next(this.currentItem.node);
          // re_slide reverse class
          this.carousel.classList.remove('is-reversing');
          this.carouselContainer.style.transform = `translateX(${Math.abs(this.offset)}px)`;
        }
        this.currentItem.node.classList.add('is-active');
        this._setOrder();
  
        // Enable transition to animate order 1 to order 2
        setTimeout(() => {
          this.carousel.classList.add('carousel-animated');
        }, 50);
        
        //this.emit('carousel:slide:after', this.currentItem);
      }
    }
  
    /**
     * Initiate autoplay system
     * @method _autoPlay
     * @param  {Number}  [delay=5000] Delay between slides in milliseconds
     * @return {void}
     */
    _autoPlay(delay = 5000) {
      this._autoPlayInterval = setInterval(() => {
        this._slide('next');
      }, delay);
    }
  }
  
  const carousels = Carousel.attach();