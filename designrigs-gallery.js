/**
 * DesignRigs Gallery — Circle shape module.
 * Arranges images evenly around a flat ring in the XZ plane, so orbiting the
 * camera around the Y axis reveals each image in turn.
 * Exposes: window.DesignRigsGalleryShapes.circle
 */
(function (global) {
  'use strict';

  var CIRCLE_RADIUS = 6;

  function generatePoints(config) {
    var density = Math.max(3, Math.round(config.shape.density || 24));
    // Fixed radius: density only changes how many points share the ring, not its size.
    var radius = CIRCLE_RADIUS;
    var points = [];

    for (var i = 0; i < density; i++) {
      var angle = (i / density) * Math.PI * 2;
      var x = Math.cos(angle) * radius;
      var z = Math.sin(angle) * radius;
      points.push({
        position: { x: x, y: 0, z: z },
        // Outward-facing normal, used when billboard mode is off.
        normal: { x: Math.cos(angle), y: 0, z: Math.sin(angle) },
        index: i
      });
    }

    return points;
  }

  // Builds the wireframe by connecting the actual image points in order
  // (closing the loop back to the first), so the ring always passes
  // exactly through every image position rather than an independent,
  // differently-segmented circle.
  function getOutlineGeometry(config, THREE, points) {
    var positions = [];
    if (points && points.length > 1) {
      for (var i = 0; i < points.length; i++) {
        var a = points[i].position;
        var b = points[(i + 1) % points.length].position;
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return { geometry: geometry, mode: 'lines' };
  }

  global.DesignRigsGalleryShapes = global.DesignRigsGalleryShapes || {};
  global.DesignRigsGalleryShapes.circle = {
    label: 'Circle',
    densityLabel: 'Point Count',
    generatePoints: generatePoints,
    getOutlineGeometry: getOutlineGeometry
  };
})(typeof window !== 'undefined' ? window : this);


/**
 * DesignRigs Gallery — Square shape module.
 * Arranges images as a flat grid "wall" in the XY plane, facing +Z.
 * Exposes: window.DesignRigsGalleryShapes.square
 */
(function (global) {
  'use strict';

  // Fixed footprint: density only changes how many points subdivide this
  // area, not the overall size of the wall.
  var SQUARE_SIZE = 8;

  function getGridDimensions(density) {
    var count = Math.max(4, Math.round(density || 25));
    var cols = Math.max(2, Math.round(Math.sqrt(count)));
    var rows = Math.max(2, Math.ceil(count / cols));
    return { cols: cols, rows: rows };
  }

  function generatePoints(config) {
    var density = config.shape.density || 25;
    var grid = getGridDimensions(density);
    var spacingX = grid.cols > 1 ? SQUARE_SIZE / (grid.cols - 1) : 0;
    var spacingY = grid.rows > 1 ? SQUARE_SIZE / (grid.rows - 1) : 0;
    var width = (grid.cols - 1) * spacingX;
    var height = (grid.rows - 1) * spacingY;
    var points = [];
    var index = 0;

    for (var r = 0; r < grid.rows; r++) {
      for (var c = 0; c < grid.cols; c++) {
        var x = c * spacingX - width / 2;
        var y = height / 2 - r * spacingY;
        points.push({
          position: { x: x, y: y, z: 0 },
          normal: { x: 0, y: 0, z: 1 },
          index: index++,
          gridRow: r,
          gridCol: c
        });
      }
    }

    return points;
  }

  // Builds the wireframe as grid lines connecting each image point to its
  // right/below neighbor, so the wireframe is the actual image grid
  // (border included) instead of a separately-sized bounding rectangle.
  function getOutlineGeometry(config, THREE, points) {
    var lookup = {};
    points.forEach(function (p) {
      lookup[p.gridRow + '_' + p.gridCol] = p;
    });

    var positions = [];
    points.forEach(function (p) {
      var right = lookup[p.gridRow + '_' + (p.gridCol + 1)];
      var down = lookup[(p.gridRow + 1) + '_' + p.gridCol];
      if (right) {
        positions.push(p.position.x, p.position.y, p.position.z, right.position.x, right.position.y, right.position.z);
      }
      if (down) {
        positions.push(p.position.x, p.position.y, p.position.z, down.position.x, down.position.y, down.position.z);
      }
    });

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return { geometry: geometry, mode: 'lines' };
  }

  global.DesignRigsGalleryShapes = global.DesignRigsGalleryShapes || {};
  global.DesignRigsGalleryShapes.square = {
    label: 'Square',
    densityLabel: 'Grid Resolution',
    generatePoints: generatePoints,
    getOutlineGeometry: getOutlineGeometry
  };
})(typeof window !== 'undefined' ? window : this);


/**
 * DesignRigs Gallery — Sphere shape module.
 * Distributes images evenly over a sphere using a Fibonacci sphere layout,
 * with an optional exclusion band around the north/south poles so images
 * don't bunch up and overlap at the top/bottom.
 * Exposes: window.DesignRigsGalleryShapes.sphere
 */
(function (global) {
  'use strict';

  var GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
  // Fixed radius: density only changes how many points subdivide the
  // sphere's surface, not the sphere's size.
  var SPHERE_RADIUS = 6;

  // Generates `count` points evenly spread over the unit sphere.
  function fibonacciSpherePoints(count) {
    var pts = [];
    for (var i = 0; i < count; i++) {
      var theta = (2 * Math.PI * i) / GOLDEN_RATIO;
      var phi = Math.acos(1 - (2 * (i + 0.5)) / count); // 0 (top) .. PI (bottom)
      var x = Math.sin(phi) * Math.cos(theta);
      var y = Math.cos(phi); // 1 (top) .. -1 (bottom)
      var z = Math.sin(phi) * Math.sin(theta);
      pts.push({ x: x, y: y, z: z });
    }
    return pts;
  }

  function generatePoints(config) {
    var density = Math.max(4, Math.round(config.shape.density || 100));
    var sphereConfig = config.sphere || {};
    var excludePoles = sphereConfig.excludePoles !== false;
    var topPct = Math.max(0, Math.min(49, sphereConfig.topExcludePercent != null ? sphereConfig.topExcludePercent : 15));
    var bottomPct = Math.max(0, Math.min(49, sphereConfig.bottomExcludePercent != null ? sphereConfig.bottomExcludePercent : 15));

    var topY = 1 - (topPct / 100) * 2; // y-threshold above which points are excluded
    var bottomY = -1 + (bottomPct / 100) * 2; // y-threshold below which points are excluded

    // Oversample so the visible (post-filter) count still lands near `density`.
    var keepFraction = excludePoles ? Math.max(0.1, 1 - (topPct + bottomPct) / 100) : 1;
    var oversampleCount = Math.ceil(density / keepFraction);

    var radius = SPHERE_RADIUS;
    var raw = fibonacciSpherePoints(oversampleCount);
    var points = [];
    var index = 0;

    for (var i = 0; i < raw.length && points.length < density; i++) {
      var p = raw[i];
      if (excludePoles && (p.y > topY || p.y < bottomY)) continue;
      points.push({
        position: { x: p.x * radius, y: p.y * radius, z: p.z * radius },
        normal: { x: p.x, y: p.y, z: p.z },
        index: index++
      });
    }

    return points;
  }

  // The Fibonacci distribution has no built-in grid/edge structure, so the
  // wireframe is built by connecting each image point to its few nearest
  // neighbors, forming a lattice that passes through every image position
  // (instead of an unrelated icosahedron subdivision).
  var NEIGHBORS_PER_POINT = 3;

  function nearestNeighborOutlinePositions(points, k) {
    var positions = [];
    var edgeSeen = {};

    for (var i = 0; i < points.length; i++) {
      var pi = points[i].position;
      var distances = [];
      for (var j = 0; j < points.length; j++) {
        if (i === j) continue;
        var pj = points[j].position;
        var dx = pi.x - pj.x;
        var dy = pi.y - pj.y;
        var dz = pi.z - pj.z;
        distances.push({ index: j, distSq: dx * dx + dy * dy + dz * dz });
      }
      distances.sort(function (a, b) { return a.distSq - b.distSq; });

      var limit = Math.min(k, distances.length);
      for (var n = 0; n < limit; n++) {
        var j2 = distances[n].index;
        var key = i < j2 ? i + '_' + j2 : j2 + '_' + i;
        if (edgeSeen[key]) continue;
        edgeSeen[key] = true;
        var pj2 = points[j2].position;
        positions.push(pi.x, pi.y, pi.z, pj2.x, pj2.y, pj2.z);
      }
    }

    return positions;
  }

  function getOutlineGeometry(config, THREE, points) {
    var positions = nearestNeighborOutlinePositions(points, NEIGHBORS_PER_POINT);
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return { geometry: geometry, mode: 'lines' };
  }

  global.DesignRigsGalleryShapes = global.DesignRigsGalleryShapes || {};
  global.DesignRigsGalleryShapes.sphere = {
    label: 'Sphere',
    densityLabel: 'Polygon Count',
    generatePoints: generatePoints,
    getOutlineGeometry: getOutlineGeometry
  };
})(typeof window !== 'undefined' ? window : this);


/**
 * DesignRigs Gallery — Cube shape module.
 * Two modes:
 *  - includeInnerVertices OFF (default): images sit along the cube's 12 outer edges.
 *  - includeInnerVertices ON: each of the 6 faces gets a full grid of images,
 *    for a much denser gallery.
 * Exposes: window.DesignRigsGalleryShapes.cube
 */
(function (global) {
  'use strict';

  // Fixed half-size: density only changes how many points subdivide the
  // cube's edges/faces, not the cube's size.
  var CUBE_HALF_SIZE = 5;

  function normalize(v) {
    var len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  function edgePoints(half, density) {
    var signs = [-half, half];
    var edges = [];

    signs.forEach(function (y) {
      signs.forEach(function (z) {
        edges.push([{ x: -half, y: y, z: z }, { x: half, y: y, z: z }]);
      });
    });
    signs.forEach(function (x) {
      signs.forEach(function (z) {
        edges.push([{ x: x, y: -half, z: z }, { x: x, y: half, z: z }]);
      });
    });
    signs.forEach(function (x) {
      signs.forEach(function (y) {
        edges.push([{ x: x, y: y, z: -half }, { x: x, y: y, z: half }]);
      });
    });

    var perEdge = Math.max(2, Math.round(density / edges.length));
    var points = [];
    var index = 0;

    edges.forEach(function (edge, edgeIndex) {
      for (var i = 0; i < perEdge; i++) {
        var t = perEdge === 1 ? 0.5 : i / (perEdge - 1);
        var pos = {
          x: edge[0].x + (edge[1].x - edge[0].x) * t,
          y: edge[0].y + (edge[1].y - edge[0].y) * t,
          z: edge[0].z + (edge[1].z - edge[0].z) * t
        };
        points.push({ position: pos, normal: normalize(pos), index: index++, edgeIndex: edgeIndex });
      }
    });

    return points;
  }

  function facePoints(half, density) {
    var faces = [
      { axis: 'x', sign: 1 }, { axis: 'x', sign: -1 },
      { axis: 'y', sign: 1 }, { axis: 'y', sign: -1 },
      { axis: 'z', sign: 1 }, { axis: 'z', sign: -1 }
    ];
    var n = Math.max(2, Math.round(Math.sqrt(density / faces.length)));
    var points = [];
    var index = 0;

    faces.forEach(function (face, faceIndex) {
      for (var i = 0; i < n; i++) {
        // Cell-centered (not corner-inclusive): keeps every point strictly
        // inside its own face so adjacent faces never generate a duplicate,
        // coincident point along a shared edge/corner (which looked like
        // more than one image stacked on the same spot).
        var u = half * (2 * ((i + 0.5) / n) - 1);
        for (var j = 0; j < n; j++) {
          var v = half * (2 * ((j + 0.5) / n) - 1);
          var pos, normal;
          if (face.axis === 'x') {
            pos = { x: face.sign * half, y: u, z: v };
            normal = { x: face.sign, y: 0, z: 0 };
          } else if (face.axis === 'y') {
            pos = { x: u, y: face.sign * half, z: v };
            normal = { x: 0, y: face.sign, z: 0 };
          } else {
            pos = { x: u, y: v, z: face.sign * half };
            normal = { x: 0, y: 0, z: face.sign };
          }
          points.push({ position: pos, normal: normal, index: index++, faceIndex: faceIndex, gridI: i, gridJ: j });
        }
      }
    });

    return points;
  }

  function generatePoints(config) {
    var density = Math.max(8, Math.round(config.shape.density || 96));
    var half = CUBE_HALF_SIZE;
    var includeInner = !!(config.cube && config.cube.includeInnerVertices);
    return includeInner ? facePoints(half, density) : edgePoints(half, density);
  }

  // Edge mode: connect consecutive points along each of the 12 edges
  // (line-strip per edge), so the wireframe passes through every image
  // position instead of just being the corner-to-corner box outline.
  function edgeOutlinePositions(points) {
    var groups = {};
    points.forEach(function (p) {
      (groups[p.edgeIndex] = groups[p.edgeIndex] || []).push(p);
    });

    var positions = [];
    Object.keys(groups).forEach(function (key) {
      var group = groups[key];
      for (var i = 0; i < group.length - 1; i++) {
        var a = group[i].position;
        var b = group[i + 1].position;
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    });
    return positions;
  }

  // Face mode: connect each point to its right/below neighbor within the
  // same face, forming the actual per-face image grid.
  function faceOutlinePositions(points) {
    var lookup = {};
    points.forEach(function (p) {
      lookup[p.faceIndex + '_' + p.gridI + '_' + p.gridJ] = p;
    });

    var positions = [];
    points.forEach(function (p) {
      var right = lookup[p.faceIndex + '_' + (p.gridI + 1) + '_' + p.gridJ];
      var down = lookup[p.faceIndex + '_' + p.gridI + '_' + (p.gridJ + 1)];
      if (right) {
        positions.push(p.position.x, p.position.y, p.position.z, right.position.x, right.position.y, right.position.z);
      }
      if (down) {
        positions.push(p.position.x, p.position.y, p.position.z, down.position.x, down.position.y, down.position.z);
      }
    });
    return positions;
  }

  function getOutlineGeometry(config, THREE, points) {
    var includeInner = !!(config.cube && config.cube.includeInnerVertices);
    var positions = includeInner ? faceOutlinePositions(points) : edgeOutlinePositions(points);
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return { geometry: geometry, mode: 'lines' };
  }

  global.DesignRigsGalleryShapes = global.DesignRigsGalleryShapes || {};
  global.DesignRigsGalleryShapes.cube = {
    label: 'Cube',
    densityLabel: 'Grid Resolution',
    generatePoints: generatePoints,
    getOutlineGeometry: getOutlineGeometry
  };
})(typeof window !== 'undefined' ? window : this);


/**
 * DesignRigs Gallery Engine
 * ---------------------------------------------------------------------------
 * Vanilla JS, dependency-free besides Three.js (loaded globally as `THREE`)
 * and the shape modules (loaded globally as `DesignRigsGalleryShapes`).
 *
 * This exact file is used both by the live editor preview (loaded at runtime
 * from /designrigs-gallery/designrigs-gallery.js) and copied verbatim into
 * every exported gallery ZIP, so the two are guaranteed to behave identically.
 *
 * Usage:
 *   var gallery = DesignRigsGallery.create(containerEl, config);
 *   gallery.update(partialConfig); // rebuilds the shape/images, keeps camera
 *   gallery.getStats();            // { imageCount, vertexCount, shapeType }
 *   gallery.destroy();
 *
 * No build step, no modules — safe to drop into a plain <script> tag.
 */
(function (global) {
  'use strict';

  var DEFAULT_CONFIG = {
    shape: { type: 'sphere', density: 100, position: { x: 0, y: 0, z: 0 } },
    images: [],
    imageSize: 1.4,
    anchor: 'center',
    billboard: true,
    rotation: { enabled: true, speed: 0.3 },
    wireframe: { enabled: true, color: '#575757', thickness: 0.01 },
    loopImages: true,
    fillDirection: 'top-to-bottom',
    sphere: { excludePoles: true, topExcludePercent: 15, bottomExcludePercent: 15 },
    cube: { includeInnerVertices: true },
    background: { color: '#0a0a0c' },
    camera: { target: { x: 0, y: 0, z: 0 }, distance: 14 },
    dof: { enabled: true, amount: 0.5, focusDistance: 8 }
  };

  function mergeConfig(base, override) {
    var out = {};
    var key;
    for (key in base) if (base.hasOwnProperty(key)) out[key] = base[key];
    if (!override) return out;
    for (key in override) {
      if (!override.hasOwnProperty(key)) continue;
      var value = override[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        out[key] = mergeConfig(base[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function quadraticBezier(a, control, b, t, out) {
    var it = 1 - t;
    out.x = it * it * a.x + 2 * it * t * control.x + t * t * b.x;
    out.y = it * it * a.y + 2 * it * t * control.y + t * t * b.y;
    out.z = it * it * a.z + 2 * it * t * control.z + t * t * b.z;
    return out;
  }

  function Gallery(container, userConfig) {
    if (!global.THREE) throw new Error('DesignRigsGallery: THREE.js must be loaded before designrigs-gallery.js');
    if (!global.DesignRigsGalleryShapes) throw new Error('DesignRigsGallery: shape modules must be loaded before designrigs-gallery.js');

    this.THREE = global.THREE;
    this.container = container;
    this.config = mergeConfig(DEFAULT_CONFIG, userConfig);
    this.textureCache = {}; // src -> THREE.Texture
    this.imageMeshes = [];
    this.galleryGroup = null;
    this.wireframeObject = null;
    this.fullscreenState = null;
    this.destroyed = false;
    this.stats = { imageCount: 0, vertexCount: 0, shapeType: this.config.shape.type, fps: 0 };
    this._fpsFrames = 0;
    this._fpsLastSample = (global.performance || Date).now();

    this._pointer = { down: false, id: null, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false };
    this._pinch = { active: false, startDist: 0, startRadius: 0 };
    var cam = this.config.camera;
    this._orbit = {
      theta: Math.PI / 4,
      phi: Math.PI / 2.6,
      radius: cam.distance,
      target: new this.THREE.Vector3(cam.target.x, cam.target.y, cam.target.z)
    };
    this._lastCameraSync = { x: cam.target.x, y: cam.target.y, z: cam.target.z, distance: cam.distance };

    this._raycaster = new this.THREE.Raycaster();
    this._pointerNDC = new this.THREE.Vector2();

    this._init();
  }

  // Re-applies config.camera.target/distance to the orbit controller, but only
  // when those specific values changed — this must NOT run unconditionally on
  // every update() call, or it would fight/undo the user's manual mouse
  // drag-to-orbit and scroll-to-zoom every time an unrelated setting changes.
  Gallery.prototype._syncCameraFromConfig = function () {
    var cam = this.config.camera;
    var last = this._lastCameraSync;
    var changed = !last || last.x !== cam.target.x || last.y !== cam.target.y || last.z !== cam.target.z || last.distance !== cam.distance;
    if (!changed) return;

    this._orbit.target.set(cam.target.x, cam.target.y, cam.target.z);
    this._orbit.radius = cam.distance;
    this._lastCameraSync = { x: cam.target.x, y: cam.target.y, z: cam.target.z, distance: cam.distance };
    if (this.camera) this._updateCameraFromOrbit();
  };

  // ---------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------

  Gallery.prototype._init = function () {
    var THREE = this.THREE;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.config.background.color);

    var rect = this.container.getBoundingClientRect();
    // Near/far kept as tight as the scene actually needs (orbit radius maxes
    // out at 200, shapes have a half-extent of a few units) rather than a
    // generic wide range — a wide near/far ratio starves the depth buffer of
    // precision, which the DOF pass reads directly and shows as banding.
    this.camera = new THREE.PerspectiveCamera(50, Math.max(1, rect.width) / Math.max(1, rect.height), 0.3, 260);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
    this.renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height));
    this.container.appendChild(this.renderer.domElement);

    var ambient = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambient);

    this._updateCameraFromOrbit();

    this.galleryGroup = new THREE.Group();
    this.scene.add(this.galleryGroup);

    this._buildGalleryGroup();
    this._bindEvents();
    this._createCloseButton();
    this._animate();
  };

  // ---------------------------------------------------------------------
  // Depth of field (custom render-to-texture blur pass)
  // ---------------------------------------------------------------------
  // Built from plain WebGLRenderTarget + DepthTexture + ShaderMaterial
  // instead of Three.js's TSL DepthOfFieldNode / post-processing addons —
  // those are ES-module only and need the node-based (WebGPU) renderer,
  // which conflicts with this engine's classic-script, file://-safe design
  // (see the top-of-file note on why Three.js is loaded as a global script).

  var DOF_VERTEX_SHADER = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var DOF_FRAGMENT_SHADER = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D tDiffuse;',
    'uniform sampler2D tDepth;',
    'uniform float cameraNear;',
    'uniform float cameraFar;',
    'uniform float focusDistance;',
    'uniform float blurAmount;',
    'uniform vec2 resolution;',
    '',
    'float perspectiveDepthToViewZ(float depth, float near, float far) {',
    '  return (near * far) / ((far - near) * depth - far);',
    '}',
    '',
    // Per-pixel hash used to rotate the sample ring by a different random
    // angle at every pixel. Without this, a small fixed set of sample
    // offsets shows up as distinct repeated "ghost" copies instead of a
    // smooth blur — this dithers that fixed pattern away.
    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);',
    '}',
    '',
    'float cocAt(vec2 uv) {',
    '  float d = texture2D(tDepth, uv).x;',
    '  float dist = -perspectiveDepthToViewZ(d, cameraNear, cameraFar);',
    '  return clamp(abs(dist - focusDistance) * blurAmount, 0.0, 24.0);',
    '}',
    '',
    'const int RINGS = 3;',
    'const int PER_RING = 8;',
    'const float TAU = 6.28318530718;',
    '',
    'void main() {',
    '  float coc = cocAt(vUv);',
    '  vec4 sharpColor = texture2D(tDiffuse, vUv);',
    '  float blend = smoothstep(0.3, 2.0, coc);',
    '  if (blend <= 0.0) {',
    '    gl_FragColor = sharpColor;',
    '    return;',
    '  }',
    '',
    // Per-pixel random base angle (kills the fixed "ghost copy" pattern);
    // each ring is also phase-staggered so samples don't line up into
    // visible spokes.
    '  float baseAngle = hash(gl_FragCoord.xy) * TAU;',
    '  vec2 px = coc / resolution;',
    '',
    '  vec4 sum = sharpColor;',
    '  float totalWeight = 1.0;',
    '',
    '  for (int r = 0; r < RINGS; r++) {',
    '    float ringRadius = (float(r) + 1.0) / float(RINGS);',
    '    float ringPhase = float(r) * 0.9;',
    '    for (int i = 0; i < PER_RING; i++) {',
    '      float a = baseAngle + ringPhase + (float(i) / float(PER_RING)) * TAU;',
    '      vec2 tapUv = vUv + vec2(cos(a), sin(a)) * ringRadius * px;',
    // Depth-aware weighting: a tap that's noticeably sharper (smaller CoC)
    // than the pixel being blurred is likely a slice of an in-focus object
    // peeking in from outside the blur radius — down-weight it instead of
    // letting it bleed a hard edge into the soft background/foreground.
    '      float tapCoC = cocAt(tapUv);',
    '      float weight = tapCoC >= coc ? 1.0 : max(tapCoC / max(coc, 0.0001), 0.15);',
    '      sum += texture2D(tDiffuse, tapUv) * weight;',
    '      totalWeight += weight;',
    '    }',
    '  }',
    '',
    '  vec4 blurredColor = sum / totalWeight;',
    '  gl_FragColor = mix(sharpColor, blurredColor, blend);',
    '}'
  ].join('\n');

  Gallery.prototype._setupDOF = function () {
    var THREE = this.THREE;
    var size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);

    var depthTexture = new THREE.DepthTexture(size.x, size.y);
    depthTexture.type = THREE.UnsignedIntType;

    this._dofRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      depthTexture: depthTexture,
      depthBuffer: true
    });

    this._dofMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: depthTexture },
        cameraNear: { value: this.camera.near },
        cameraFar: { value: this.camera.far },
        focusDistance: { value: this.config.dof.focusDistance },
        blurAmount: { value: 0 },
        resolution: { value: size.clone() }
      },
      vertexShader: DOF_VERTEX_SHADER,
      fragmentShader: DOF_FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false
    });

    this._dofQuadScene = new THREE.Scene();
    this._dofQuadCamera = new THREE.Camera(); // matrices unused; vertex shader writes clip space directly
    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._dofMaterial);
    quad.frustumCulled = false;
    this._dofQuadScene.add(quad);
  };

  Gallery.prototype._resizeDOF = function () {
    if (!this._dofRenderTarget) return;
    var THREE = this.THREE;
    var size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    this._dofRenderTarget.setSize(size.x, size.y);
    this._dofMaterial.uniforms.resolution.value.copy(size);
  };

  Gallery.prototype._renderWithDOF = function () {
    if (!this._dofRenderTarget) this._setupDOF();

    var u = this._dofMaterial.uniforms;
    u.cameraNear.value = this.camera.near;
    u.cameraFar.value = this.camera.far;
    // While an image is in lightbox mode, rack focus onto it directly
    // (tracking its live position through the open/close fly animation)
    // instead of the configured focus distance, so it's always sharp
    // regardless of where the shape itself is focused.
    u.focusDistance.value = this.fullscreenState
      ? this.camera.position.distanceTo(this.fullscreenState.mesh.position)
      : this.config.dof.focusDistance;
    u.blurAmount.value = Math.max(0, this.config.dof.amount) * 8;

    this.renderer.setRenderTarget(this._dofRenderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);

    u.tDiffuse.value = this._dofRenderTarget.texture;
    this.renderer.render(this._dofQuadScene, this._dofQuadCamera);
  };

  Gallery.prototype._disposeDOF = function () {
    if (!this._dofRenderTarget) return;
    this._dofRenderTarget.dispose();
    this._dofRenderTarget.depthTexture.dispose();
    this._dofMaterial.dispose();
    this._dofQuadScene.children[0].geometry.dispose();
    this._dofRenderTarget = null;
  };

  // ---------------------------------------------------------------------
  // Orbit camera controls (mouse + touch, no external dependency)
  // ---------------------------------------------------------------------

  Gallery.prototype._updateCameraFromOrbit = function () {
    var o = this._orbit;
    var phi = Math.max(0.05, Math.min(Math.PI - 0.05, o.phi));
    this.camera.position.set(
      o.target.x + o.radius * Math.sin(phi) * Math.sin(o.theta),
      o.target.y + o.radius * Math.cos(phi),
      o.target.z + o.radius * Math.sin(phi) * Math.cos(o.theta)
    );
    this.camera.lookAt(o.target);
  };

  Gallery.prototype._bindEvents = function () {
    var self = this;
    var el = this.renderer.domElement;

    this._onResize = function () { self._handleResize(); };
    if (global.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this.container);
    } else {
      global.addEventListener('resize', this._onResize);
    }

    this._onPointerDown = function (e) {
      if (self.fullscreenState) return;
      self._pointer.down = true;
      self._pointer.id = e.pointerId;
      self._pointer.startX = self._pointer.lastX = e.clientX;
      self._pointer.startY = self._pointer.lastY = e.clientY;
      self._pointer.moved = false;
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
    };

    this._onPointerMove = function (e) {
      if (!self._pointer.down || e.pointerId !== self._pointer.id) return;
      var dx = e.clientX - self._pointer.lastX;
      var dy = e.clientY - self._pointer.lastY;
      self._pointer.lastX = e.clientX;
      self._pointer.lastY = e.clientY;
      if (Math.abs(e.clientX - self._pointer.startX) > 4 || Math.abs(e.clientY - self._pointer.startY) > 4) {
        self._pointer.moved = true;
      }
      self._orbit.theta -= dx * 0.006;
      self._orbit.phi -= dy * 0.006;
      self._updateCameraFromOrbit();
    };

    this._onPointerUp = function (e) {
      if (e.pointerId !== self._pointer.id) return;
      var wasClick = self._pointer.down && !self._pointer.moved;
      self._pointer.down = false;
      self._pointer.id = null;
      if (wasClick) self._handleClick(e.clientX, e.clientY);
    };

    this._onWheel = function (e) {
      if (self.fullscreenState) return;
      e.preventDefault();
      var delta = e.deltaY * 0.01;
      self._orbit.radius = Math.max(2, Math.min(200, self._orbit.radius + delta));
      self._updateCameraFromOrbit();
    };

    this._onTouchStart = function (e) {
      if (self.fullscreenState) return;
      if (e.touches.length === 2) {
        self._pinch.active = true;
        self._pinch.startDist = self._touchDistance(e.touches);
        self._pinch.startRadius = self._orbit.radius;
      }
    };

    this._onTouchMove = function (e) {
      if (self.fullscreenState) return;
      if (self._pinch.active && e.touches.length === 2) {
        e.preventDefault();
        var dist = self._touchDistance(e.touches);
        var scale = self._pinch.startDist / Math.max(1, dist);
        self._orbit.radius = Math.max(2, Math.min(200, self._pinch.startRadius * scale));
        self._updateCameraFromOrbit();
      }
    };

    this._onTouchEnd = function (e) {
      if (e.touches.length < 2) self._pinch.active = false;
    };

    el.addEventListener('pointerdown', this._onPointerDown);
    global.addEventListener('pointermove', this._onPointerMove);
    global.addEventListener('pointerup', this._onPointerUp);
    el.addEventListener('wheel', this._onWheel, { passive: false });
    el.addEventListener('touchstart', this._onTouchStart, { passive: true });
    el.addEventListener('touchmove', this._onTouchMove, { passive: false });
    el.addEventListener('touchend', this._onTouchEnd, { passive: true });
  };

  Gallery.prototype._touchDistance = function (touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  Gallery.prototype._handleResize = function () {
    var rect = this.container.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
    this._resizeDOF();
  };

  // ---------------------------------------------------------------------
  // Gallery group construction (shape + images + wireframe)
  // ---------------------------------------------------------------------

  Gallery.prototype._disposeGalleryGroup = function () {
    var THREE = this.THREE;
    this.imageMeshes.forEach(function (mesh) {
      mesh.geometry.dispose();
      if (mesh.material.map) mesh.material.map = null;
      mesh.material.dispose();
    });
    this.imageMeshes = [];

    while (this.galleryGroup.children.length) {
      this.galleryGroup.remove(this.galleryGroup.children[0]);
    }
    if (this.wireframeObject) {
      this.wireframeObject.geometry.dispose();
      this.wireframeObject.material.dispose();
      this.wireframeObject = null;
    }
  };

  // Builds the wireframe outline as flat, camera-facing ribbons (a quad per
  // segment, billboarded around its own axis every frame) rather than
  // THREE.Line/LineBasicMaterial — WebGL ignores `linewidth` on almost every
  // platform (ANGLE/Direct3D caps it at 1px), so that approach can never
  // actually render a configurable thickness. This reads as a flat 2D line
  // from any viewing angle instead of a 3D tube, and the width is real.
  Gallery.prototype._buildWireframeMesh = function (outline, thickness, color) {
    var THREE = this.THREE;
    var positions = outline.geometry.attributes.position.array;
    var pointCount = positions.length / 3;
    var segments = [];

    for (var j = 0; j + 1 < pointCount; j += 2) segments.push([j, j + 1]);

    var width = Math.max(0.005, thickness);
    // Unit ribbon: 1 unit long (Y), `width` wide (X); length is applied per-instance via scale.y.
    var unitGeometry = new THREE.PlaneGeometry(width, 1);
    var material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    var mesh = new THREE.InstancedMesh(unitGeometry, material, Math.max(1, segments.length));
    mesh.count = segments.length;

    var a = new THREE.Vector3();
    var b = new THREE.Vector3();
    var segmentData = [];
    for (var s = 0; s < segments.length; s++) {
      var ia = segments[s][0] * 3;
      var ib = segments[s][1] * 3;
      a.set(positions[ia], positions[ia + 1], positions[ia + 2]);
      b.set(positions[ib], positions[ib + 1], positions[ib + 2]);
      var dir = new THREE.Vector3().subVectors(b, a);
      var length = dir.length() || 0.0001;
      dir.normalize();
      segmentData.push({
        midpoint: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
        direction: dir,
        length: length
      });
    }

    // Consumed every frame by _updateWireframeBillboard to orient each ribbon.
    mesh.userData.segmentData = segmentData;
    return mesh;
  };

  // Rotates each wireframe ribbon around its own segment axis so its flat
  // face always points toward the camera, regardless of orbit angle.
  Gallery.prototype._updateWireframeBillboard = function () {
    var mesh = this.wireframeObject;
    if (!mesh || !mesh.userData.segmentData) return;

    var THREE = this.THREE;
    var segmentData = mesh.userData.segmentData;
    var parentInverse = this._tmpParentInverseQuat || (this._tmpParentInverseQuat = new THREE.Quaternion());
    parentInverse.copy(this.galleryGroup.quaternion).invert();

    var worldMid = new THREE.Vector3();
    var worldDir = new THREE.Vector3();
    var toCamera = new THREE.Vector3();
    var right = new THREE.Vector3();
    var normal = new THREE.Vector3();
    var basis = new THREE.Matrix4();
    var worldQuat = new THREE.Quaternion();
    var localQuat = new THREE.Quaternion();
    var scale = new THREE.Vector3();
    var matrix = new THREE.Matrix4();

    for (var i = 0; i < segmentData.length; i++) {
      var seg = segmentData[i];
      worldMid.copy(seg.midpoint).applyMatrix4(this.galleryGroup.matrixWorld);
      worldDir.copy(seg.direction).applyQuaternion(this.galleryGroup.quaternion).normalize();
      toCamera.copy(this.camera.position).sub(worldMid).normalize();

      right.crossVectors(worldDir, toCamera);
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0); // segment pointing straight at camera; pick any perpendicular
      right.normalize();
      normal.crossVectors(right, worldDir).normalize();

      basis.makeBasis(right, worldDir, normal);
      worldQuat.setFromRotationMatrix(basis);
      localQuat.copy(parentInverse).multiply(worldQuat);

      scale.set(1, seg.length, 1);
      matrix.compose(seg.midpoint, localQuat, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  Gallery.prototype._buildGalleryGroup = function () {
    var THREE = this.THREE;
    var config = this.config;
    this._disposeGalleryGroup();

    this.galleryGroup.position.set(config.shape.position.x, config.shape.position.y, config.shape.position.z);

    var shapeModule = global.DesignRigsGalleryShapes[config.shape.type];
    if (!shapeModule) shapeModule = global.DesignRigsGalleryShapes.sphere;

    var points = shapeModule.generatePoints(config);
    this.stats.vertexCount = points.length;
    this.stats.shapeType = config.shape.type;
    this.stats.imageCount = config.images.length;

    // --- Wireframe outline ---
    if (config.wireframe.enabled && shapeModule.getOutlineGeometry) {
      var outline = shapeModule.getOutlineGeometry(config, THREE, points);
      var wireframeMesh = this._buildWireframeMesh(outline, config.wireframe.thickness, config.wireframe.color);
      this.galleryGroup.add(wireframeMesh);
      this.wireframeObject = wireframeMesh;
    }

    // --- Image assignment across points ---
    var images = config.images || [];
    if (images.length === 0 || points.length === 0) return;

    // Sort/shuffle the actual placement points (not the image list) so fill
    // direction reflects real vertical position, regardless of the order a
    // given shape module happens to generate its points in.
    var orderedPoints = this._orderPointsForFill(points, config.fillDirection);

    for (var i = 0; i < orderedPoints.length; i++) {
      var imgIndex;
      if (i < images.length) {
        imgIndex = i;
      } else if (config.loopImages) {
        imgIndex = i % images.length;
      } else {
        break;
      }
      this._createImageMesh(orderedPoints[i], images[imgIndex]);
    }
  };

  Gallery.prototype._orderPointsForFill = function (points, direction) {
    var list = points.slice();
    if (direction === 'top-to-bottom') {
      list.sort(function (a, b) { return b.position.y - a.position.y; });
    } else if (direction === 'bottom-to-top') {
      list.sort(function (a, b) { return a.position.y - b.position.y; });
    } else if (direction === 'random') {
      for (var i = list.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      }
    }
    return list;
  };

  Gallery.prototype._getTexture = function (src) {
    var THREE = this.THREE;
    if (this.textureCache[src]) return this.textureCache[src];
    var loader = new THREE.TextureLoader();
    var texture = loader.load(src, this._onTextureLoaded.bind(this));
    texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
    this.textureCache[src] = texture;
    return texture;
  };

  Gallery.prototype._onTextureLoaded = function (texture) {
    if (this.destroyed) return;
    var aspect = (texture.image && texture.image.width && texture.image.height)
      ? texture.image.width / texture.image.height
      : 1;
    this.imageMeshes.forEach(function (mesh) {
      if (mesh.material.map === texture && !mesh.userData.sized) {
        mesh.userData.sized = true;
        this._applyPlaneGeometry(mesh, aspect);
      }
    }, this);
  };

  Gallery.prototype._applyPlaneGeometry = function (mesh, aspect) {
    var THREE = this.THREE;
    var size = this.config.imageSize;
    var width = aspect >= 1 ? size : size * aspect;
    var height = aspect >= 1 ? size / aspect : size;
    var geometry = new THREE.PlaneGeometry(width, height);

    var offsetX = 0, offsetY = 0;
    var anchor = this.config.anchor;
    if (anchor === 'top') offsetY = -height / 2;
    else if (anchor === 'bottom') offsetY = height / 2;
    else if (anchor === 'left') offsetX = width / 2;
    else if (anchor === 'right') offsetX = -width / 2;
    if (offsetX || offsetY) geometry.translate(offsetX, offsetY, 0);

    mesh.geometry.dispose();
    mesh.geometry = geometry;
    mesh.userData.width = width;
    mesh.userData.height = height;
  };

  // Builds a "face outward along `normal`, but stay upright" orientation for
  // shape-locked (non-billboard) images. Using Quaternion.setFromUnitVectors
  // alone only constrains which way the plane faces — it leaves the roll
  // around that axis free, so different points end up tilted at arbitrary,
  // inconsistent angles. This instead builds an explicit basis that keeps
  // the image's "up" as close to world-up as the normal direction allows,
  // the same way a camera lookAt() with an up vector would.
  Gallery.prototype._orientationForNormal = function (normal) {
    var THREE = this.THREE;
    var worldUp = this._tmpWorldUp || (this._tmpWorldUp = new THREE.Vector3(0, 1, 0));
    var poleUp = this._tmpPoleUp || (this._tmpPoleUp = new THREE.Vector3(0, 0, 1));
    var referenceUp = Math.abs(normal.dot(worldUp)) > 0.999 ? poleUp : worldUp;

    var right = this._tmpRight || (this._tmpRight = new THREE.Vector3());
    var up = this._tmpUp || (this._tmpUp = new THREE.Vector3());
    right.crossVectors(referenceUp, normal).normalize();
    up.crossVectors(normal, right).normalize();

    var basis = this._tmpBasisMatrix || (this._tmpBasisMatrix = new THREE.Matrix4());
    basis.makeBasis(right, up, normal);

    var quat = this._tmpOrientQuat || (this._tmpOrientQuat = new THREE.Quaternion());
    return quat.setFromRotationMatrix(basis);
  };

  Gallery.prototype._createImageMesh = function (point, imageEntry) {
    var THREE = this.THREE;
    var texture = this._getTexture(imageEntry.src);
    var material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
    var geometry = new THREE.PlaneGeometry(this.config.imageSize, this.config.imageSize);
    var mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(point.position.x, point.position.y, point.position.z);
    mesh.userData.normal = point.normal;
    mesh.userData.sized = false;

    if (!this.config.billboard) {
      var normal = new THREE.Vector3(point.normal.x, point.normal.y, point.normal.z).normalize();
      mesh.quaternion.copy(this._orientationForNormal(normal));
    }

    this.galleryGroup.add(mesh);
    this.imageMeshes.push(mesh);

    if (texture.image) this._onTextureLoaded(texture);
  };

  // ---------------------------------------------------------------------
  // Fullscreen click transition
  // ---------------------------------------------------------------------

  Gallery.prototype._createCloseButton = function () {
    var self = this;
    var button = global.document.createElement('button');
    button.textContent = '×';
    button.setAttribute('aria-label', 'Close image');
    button.style.cssText = [
      'position:absolute', 'top:16px', 'right:16px', 'width:40px', 'height:40px',
      'border-radius:50%', 'border:1px solid rgba(255,255,255,0.4)', 'background:rgba(0,0,0,0.5)',
      'color:#fff', 'font-size:20px', 'line-height:1', 'cursor:pointer', 'z-index:10',
      'display:none', 'align-items:center', 'justify-content:center', 'backdrop-filter:blur(6px)'
    ].join(';');
    button.addEventListener('click', function (e) {
      e.stopPropagation();
      self._closeFullscreen();
    });
    var computedPosition = global.getComputedStyle ? global.getComputedStyle(this.container).position : '';
    if (!computedPosition || computedPosition === 'static') {
      this.container.style.position = 'relative';
    }
    this.container.appendChild(button);
    this.closeButton = button;
  };

  // A camera-facing dark plane placed just behind the lightbox image (so the
  // image itself is unaffected) and in front of the gallery shape, dimming
  // everything behind it. Shown only once the open animation has settled —
  // showing it during the fly-in would put it in front of the still-distant
  // image for most of the transition.
  var LIGHTBOX_OVERLAY_OPACITY = 0.9;
  var LIGHTBOX_OVERLAY_FADE_MS = 350;

  Gallery.prototype._ensureLightboxOverlay = function () {
    if (this._lightboxOverlay) return this._lightboxOverlay;
    var THREE = this.THREE;
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this._lightboxOverlay = mesh;
    return mesh;
  };

  Gallery.prototype._showLightboxOverlay = function (imagePos) {
    var THREE = this.THREE;
    var overlay = this._ensureLightboxOverlay();

    var camPos = this.camera.position;
    var imageDistance = camPos.distanceTo(imagePos);
    var overlayDistance = imageDistance + 0.3;
    var dir = new THREE.Vector3().subVectors(imagePos, camPos).normalize();

    var fovRad = (this.camera.fov * Math.PI) / 180;
    var overlayHeight = 2 * Math.tan(fovRad / 2) * overlayDistance * 1.05;
    var overlayWidth = overlayHeight * this.camera.aspect;

    overlay.geometry.dispose();
    overlay.geometry = new THREE.PlaneGeometry(overlayWidth, overlayHeight);
    overlay.position.copy(camPos).addScaledVector(dir, overlayDistance);
    overlay.quaternion.copy(this.camera.quaternion);
    overlay.material.opacity = 0;
    overlay.visible = true;

    this._overlayFade = {
      startTime: (global.performance || Date).now(),
      duration: LIGHTBOX_OVERLAY_FADE_MS,
      from: 0,
      to: LIGHTBOX_OVERLAY_OPACITY
    };
  };

  Gallery.prototype._hideLightboxOverlay = function () {
    this._overlayFade = null;
    if (this._lightboxOverlay) this._lightboxOverlay.visible = false;
  };

  Gallery.prototype._updateLightboxOverlayFade = function () {
    var fade = this._overlayFade;
    if (!fade || !this._lightboxOverlay) return;
    var now = (global.performance || Date).now();
    var t = Math.min(1, (now - fade.startTime) / fade.duration);
    this._lightboxOverlay.material.opacity = fade.from + (fade.to - fade.from) * t;
    if (t >= 1) this._overlayFade = null;
  };

  Gallery.prototype._handleClick = function (clientX, clientY) {
    if (this.fullscreenState) {
      this._closeFullscreen();
      return;
    }
    var rect = this.container.getBoundingClientRect();
    this._pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointerNDC, this.camera);
    var hits = this._raycaster.intersectObjects(this.imageMeshes, false);
    if (hits.length > 0) this._openFullscreen(hits[0].object);
  };

  Gallery.prototype._worldTransformOf = function (localMesh) {
    var THREE = this.THREE;
    var pos = new THREE.Vector3();
    var quat = new THREE.Quaternion();
    var scale = new THREE.Vector3();
    localMesh.updateMatrixWorld(true);
    localMesh.getWorldPosition(pos);
    localMesh.getWorldQuaternion(quat);
    localMesh.getWorldScale(scale);
    return { position: pos, quaternion: quat, scale: scale };
  };

  Gallery.prototype._openFullscreen = function (mesh) {
    var THREE = this.THREE;
    var from = this._worldTransformOf(mesh);

    var original = {
      position: mesh.position.clone(),
      quaternion: mesh.quaternion.clone(),
      scale: mesh.scale.clone()
    };

    // Reparent to the scene root so its transform is world-space during the animation.
    this.galleryGroup.remove(mesh);
    this.scene.add(mesh);
    mesh.position.copy(from.position);
    mesh.quaternion.copy(from.quaternion);
    mesh.scale.copy(from.scale);

    var forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    var distance = 4;
    var targetPos = this.camera.position.clone().add(forward.multiplyScalar(distance));
    var targetQuat = this.camera.quaternion.clone();

    // Contain-fit: scale by whichever axis (height or width) is the tighter
    // constraint, so wide images fit by width and tall images fit by height
    // instead of always scaling to a fixed height and risking overflow off
    // the sides on a narrow/portrait viewport.
    var fovRad = (this.camera.fov * Math.PI) / 180;
    var visibleHeight = 2 * Math.tan(fovRad / 2) * distance;
    var visibleWidth = visibleHeight * this.camera.aspect;
    var margin = 0.9;
    var naturalWidth = mesh.userData.width || this.config.imageSize;
    var naturalHeight = mesh.userData.height || this.config.imageSize;
    var scaleByHeight = (visibleHeight * margin) / naturalHeight;
    var scaleByWidth = (visibleWidth * margin) / naturalWidth;
    var targetScaleFactor = Math.min(scaleByHeight, scaleByWidth);
    var targetScale = new THREE.Vector3(targetScaleFactor, targetScaleFactor, targetScaleFactor);

    this.fullscreenState = {
      mesh: mesh,
      originalLocal: original,
      fromPos: from.position.clone(),
      fromQuat: from.quaternion.clone(),
      fromScale: from.scale.clone(),
      toPos: targetPos,
      toQuat: targetQuat,
      toScale: targetScale,
      startTime: (global.performance || Date).now(),
      duration: 700,
      phase: 'opening'
    };

    if (this.closeButton) this.closeButton.style.display = 'flex';
  };

  Gallery.prototype._closeFullscreen = function () {
    var state = this.fullscreenState;
    if (!state || state.phase === 'closing') return;

    var THREE = this.THREE;
    // Compute where the mesh's original local transform sits in world space right now.
    var dummy = new THREE.Object3D();
    dummy.position.copy(state.originalLocal.position);
    dummy.quaternion.copy(state.originalLocal.quaternion);
    dummy.scale.copy(state.originalLocal.scale);
    this.galleryGroup.add(dummy);
    dummy.updateMatrixWorld(true);
    var worldPos = new THREE.Vector3();
    var worldQuat = new THREE.Quaternion();
    var worldScale = new THREE.Vector3();
    dummy.getWorldPosition(worldPos);
    dummy.getWorldQuaternion(worldQuat);
    dummy.getWorldScale(worldScale);
    this.galleryGroup.remove(dummy);

    state.fromPos = state.mesh.position.clone();
    state.fromQuat = state.mesh.quaternion.clone();
    state.fromScale = state.mesh.scale.clone();
    state.toPos = worldPos;
    state.toQuat = worldQuat;
    state.toScale = worldScale;
    state.startTime = (global.performance || Date).now();
    state.phase = 'closing';

    this._hideLightboxOverlay();
    if (this.closeButton) this.closeButton.style.display = 'none';
  };

  Gallery.prototype._updateFullscreenAnimation = function () {
    var state = this.fullscreenState;
    if (!state) return;
    if (state.phase === 'open') return;

    var now = (global.performance || Date).now();
    var t = Math.min(1, (now - state.startTime) / state.duration);
    var eased = state.phase === 'closing' ? easeInOutCubic(t) : easeOutCubic(t);

    var mid = {
      x: (state.fromPos.x + state.toPos.x) / 2,
      y: (state.fromPos.y + state.toPos.y) / 2 + state.fromPos.distanceTo(state.toPos) * 0.35,
      z: (state.fromPos.z + state.toPos.z) / 2
    };

    var pos = new this.THREE.Vector3();
    quadraticBezier(state.fromPos, mid, state.toPos, eased, pos);
    state.mesh.position.copy(pos);
    state.mesh.quaternion.slerpQuaternions(state.fromQuat, state.toQuat, eased);
    state.mesh.scale.lerpVectors(state.fromScale, state.toScale, eased);

    if (t >= 1) {
      if (state.phase === 'opening') {
        state.phase = 'open';
        this._showLightboxOverlay(state.mesh.position);
      } else if (state.phase === 'closing') {
        this.scene.remove(state.mesh);
        this.galleryGroup.add(state.mesh);
        state.mesh.position.copy(state.originalLocal.position);
        state.mesh.quaternion.copy(state.originalLocal.quaternion);
        state.mesh.scale.copy(state.originalLocal.scale);
        this.fullscreenState = null;
      }
    }
  };

  // ---------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------

  Gallery.prototype._animate = function () {
    if (this.destroyed) return;
    this._frameId = global.requestAnimationFrame(this._animate.bind(this));

    if (this.config.rotation.enabled && !this.fullscreenState) {
      this.galleryGroup.rotation.y += this.config.rotation.speed * 0.01;
    }

    if (this.config.billboard) {
      var parentInverse = this.galleryGroup.quaternion.clone().invert();
      var lookMatrix = new this.THREE.Matrix4();
      var worldPos = new this.THREE.Vector3();
      var faceQuat = new this.THREE.Quaternion();
      for (var i = 0; i < this.imageMeshes.length; i++) {
        var mesh = this.imageMeshes[i];
        if (this.fullscreenState && this.fullscreenState.mesh === mesh) continue;
        mesh.getWorldPosition(worldPos);
        // Mindunter fix: eye/target were swapped, which turned each poster's back to the camera (mirrored art)
        lookMatrix.lookAt(this.camera.position, worldPos, this.camera.up);
        faceQuat.setFromRotationMatrix(lookMatrix);
        mesh.quaternion.copy(parentInverse).multiply(faceQuat);
      }
    }

    this._updateWireframeBillboard();
    this._updateFullscreenAnimation();
    this._updateLightboxOverlayFade();

    if (this.config.dof.enabled) {
      this._renderWithDOF();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this._fpsFrames++;
    var now = (global.performance || Date).now();
    if (now - this._fpsLastSample >= 500) {
      this.stats.fps = Math.round((this._fpsFrames * 1000) / (now - this._fpsLastSample));
      this._fpsFrames = 0;
      this._fpsLastSample = now;
    }
  };

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  Gallery.prototype.update = function (partialConfig) {
    this.config = mergeConfig(this.config, partialConfig);
    this.scene.background.set(this.config.background.color);
    this._syncCameraFromConfig();
    this._buildGalleryGroup();
  };

  Gallery.prototype.getStats = function () {
    return {
      imageCount: this.stats.imageCount,
      vertexCount: this.stats.vertexCount,
      shapeType: this.stats.shapeType,
      fps: this.stats.fps
    };
  };

  Gallery.prototype.destroy = function () {
    this.destroyed = true;
    if (this._frameId) global.cancelAnimationFrame(this._frameId);

    var el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this._onPointerDown);
    global.removeEventListener('pointermove', this._onPointerMove);
    global.removeEventListener('pointerup', this._onPointerUp);
    el.removeEventListener('wheel', this._onWheel);
    el.removeEventListener('touchstart', this._onTouchStart);
    el.removeEventListener('touchmove', this._onTouchMove);
    el.removeEventListener('touchend', this._onTouchEnd);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    else global.removeEventListener('resize', this._onResize);

    this._disposeGalleryGroup();
    this._disposeDOF();

    if (this._lightboxOverlay) {
      this._lightboxOverlay.geometry.dispose();
      this._lightboxOverlay.material.dispose();
      this.scene.remove(this._lightboxOverlay);
      this._lightboxOverlay = null;
    }

    Object.keys(this.textureCache).forEach(function (src) {
      this.textureCache[src].dispose();
    }, this);
    this.textureCache = {};

    if (this.closeButton && this.closeButton.parentNode) this.closeButton.parentNode.removeChild(this.closeButton);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  };

  global.DesignRigsGallery = {
    create: function (container, config) {
      return new Gallery(container, config || {});
    }
  };
})(typeof window !== 'undefined' ? window : this);
