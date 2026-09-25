/**
 * @Author: rogue-dev-studio
 * @Date: 2026-09-25 12:58:10
 * @Last Modified by: rogue-dev-studio
 * @Last Modified time: 2026-09-25 14:06:07
 */

(function () {
    'use strict';

    const MIN_DWELL_MS = 2800;
    const STATUS_IDLE = '';
    const MSG_INVALID = 'Lengkapi semua field yang wajib diisi.';
    const MSG_CAPTCHA = 'Masukkan bola ke keranjang dulu sebelum mengirim.';
    const MSG_BLOCKED = 'Tidak dapat mengirim. Muat ulang halaman dan coba lagi.';
    const MSG_READY = 'Siap dikirim — aplikasi email Anda akan terbuka.';
    const MSG_NO_WEBGL = 'Gagal memuat library 3D. Cek koneksi internet, lalu muat ulang halaman.';

    const pageOpenedAt = Date.now();
    let humanTouched = false;
    let captchaPassed = false;
    let game = null;

    const enc = Object.freeze([
        42, 227, 71, 4, 237, 112, 196, 59,
        34, 226, 65, 7, 170, 97, 196, 49,
        11, 246, 67, 22, 170, 116, 139, 60,
        36, 252
    ]);

    function keyBytes() {
        return [0x4B, 0x91, 0x2E, 0x77, 0xC3, 0x18, 0xA5, 0x5F];
    }

    function resolveInbox() {
        const key = keyBytes();
        let out = '';
        for (let i = 0; i < enc.length; i += 1) {
            out += String.fromCharCode(enc[i] ^ key[i % key.length]);
        }
        return out;
    }

    function setStatus(el, message, tone) {
        if (!el) return;
        el.textContent = message;
        el.dataset.tone = tone || 'info';
        el.hidden = !message;
    }

    function setCaptchaPassed(passed) {
        captchaPassed = passed;
        const flag = document.getElementById('contact-captcha-pass');
        const submit = document.getElementById('contact-submit');
        const gameStatus = document.getElementById('captcha-game-status');
        if (flag) flag.value = passed ? '1' : '0';
        if (submit) submit.disabled = !passed;
        if (gameStatus) {
            gameStatus.textContent = passed
                ? 'Skor! Verifikasi berhasil — silakan kirim pesan.'
                : 'Tarik bola di tengah ke bawah, lalu lepas ke arah keranjang.';
            gameStatus.dataset.state = passed ? 'ok' : 'play';
        }
    }

    function isBotSubmission(form) {
        const trap = form.querySelector('[data-contact-trap]');
        if (trap && String(trap.value || '').trim() !== '') {
            return true;
        }
        if (Date.now() - pageOpenedAt < MIN_DWELL_MS) {
            return true;
        }
        if (!humanTouched) {
            return true;
        }
        return false;
    }

    function makeCanvasTexture(THREE, draw, size) {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        draw(c.getContext('2d'), size);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    function createWoodTexture(THREE) {
        return makeCanvasTexture(THREE, (ctx, size) => {
            ctx.fillStyle = '#c9a56a';
            ctx.fillRect(0, 0, size, size);
            for (let i = 0; i < 28; i += 1) {
                const y = (i / 28) * size;
                ctx.strokeStyle = `rgba(90,55,20,${0.12 + (i % 3) * 0.05})`;
                ctx.lineWidth = 2 + (i % 2);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.bezierCurveTo(size * 0.3, y + 4, size * 0.7, y - 4, size, y + 2);
                ctx.stroke();
            }
        }, 256);
    }

    function createBasketGame3D(host, THREE) {
        const woodMap = createWoodTexture(THREE);
        woodMap.repeat.set(2, 4);

        const mount = host.querySelector('.captcha-viewport') || host;
        const flash = host.querySelector('.captcha-score-flash');
        const width = () => Math.max(mount.clientWidth, 280);
        const height = () => Math.max(mount.clientHeight, 320);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xd7e0ec);
        scene.fog = new THREE.Fog(0xd7e0ec, 32, 62);

        // Half-court + elevated 3/4 camera (ball foreground → hoop baseline).
        const HOOP_Z = -3.15;
        const BALL_Z = 2.05;
        const COURT_W = 6.2;
        const COURT_L = 7.4;
        const COURT_Z0 = (HOOP_Z - 0.55 + BALL_Z + 1.15) / 2;
        // Pull back + higher from left so full half-court and ball arc stay in frame.
        const camHome = new THREE.Vector3(-9.4, 9.2, 11.5);
        const lookHome = new THREE.Vector3(0, 1.25, COURT_Z0 + 0.1);

        const camera = new THREE.PerspectiveCamera(40, width() / height(), 0.1, 120);
        camera.position.copy(camHome);
        camera.lookAt(lookHome);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width(), height());
        renderer.shadowMap.enabled = true;
        if (renderer.outputColorSpace !== undefined) {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
        }

        const timeHud = host.querySelector('.captcha-time-hud');
        const powerHud = host.querySelector('.captcha-power-hud');
        const timeEl = host.querySelector('[data-board="time"]');
        const powerNeedleEl = host.querySelector('[data-power-needle]');
        const powerValueEl = host.querySelector('[data-power-value]');
        mount.innerHTML = '';
        if (powerHud) mount.appendChild(powerHud);
        if (timeHud) mount.appendChild(timeHud);
        mount.appendChild(renderer.domElement);
        renderer.domElement.className = 'captcha-game-canvas';
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';

        let scoreValue = 0;
        let timeLeft = 45;
        let timerArmed = false;

        function paintBoard() {
            if (timeEl) timeEl.textContent = String(Math.max(0, Math.ceil(timeLeft))).padStart(2, '0');
        }
        paintBoard();

        scene.add(new THREE.AmbientLight(0xffffff, 0.95));
        const hemi = new THREE.HemisphereLight(0xf5f8ff, 0x8a9bb0, 0.75);
        scene.add(hemi);
        const sun = new THREE.DirectionalLight(0xffffff, 1.15);
        sun.position.set(-5, 9, 4);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        scene.add(sun);
        const ballLight = new THREE.PointLight(0xffd2a8, 1.1, 10);
        ballLight.position.set(-0.4, 1.6, BALL_Z + 0.2);
        scene.add(ballLight);

        // Half court platform
        const border = new THREE.Mesh(
            new THREE.BoxGeometry(COURT_W + 0.55, 0.22, COURT_L + 0.55),
            new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.75, metalness: 0.08 })
        );
        border.position.set(0, -0.11, COURT_Z0);
        border.receiveShadow = true;
        scene.add(border);

        // Outer play bounds — well outside the half-court, not hugging the paint.
        const BOUND_MARGIN = 2.85;
        const boundMinX = -COURT_W / 2 - BOUND_MARGIN;
        const boundMaxX = COURT_W / 2 + BOUND_MARGIN;
        const boundMinZ = COURT_Z0 - COURT_L / 2 - BOUND_MARGIN;
        const boundMaxZ = COURT_Z0 + COURT_L / 2 + BOUND_MARGIN;
        const boundW = boundMaxX - boundMinX;
        const boundL = boundMaxZ - boundMinZ;
        const boundCx = (boundMinX + boundMaxX) / 2;
        const boundCz = (boundMinZ + boundMaxZ) / 2;
        const WALL_H = 1.15;
        const WALL_T = 0.18;
        const WALL_RESTITUTION = 0.62;

        const apron = new THREE.Mesh(
            new THREE.PlaneGeometry(boundW + 0.4, boundL + 0.4),
            new THREE.MeshStandardMaterial({ color: 0xb7c2ce, roughness: 0.92, metalness: 0.02 })
        );
        apron.rotation.x = -Math.PI / 2;
        apron.position.set(boundCx, -0.005, boundCz);
        apron.receiveShadow = true;
        scene.add(apron);

        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x6d7886,
            roughness: 0.78,
            metalness: 0.08,
            transparent: true,
            opacity: 0.55
        });
        function addBoundWall(w, d, x, z) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat);
            mesh.position.set(x, WALL_H * 0.5, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
        }
        addBoundWall(boundW + WALL_T * 2, WALL_T, boundCx, boundMinZ - WALL_T * 0.5);
        addBoundWall(boundW + WALL_T * 2, WALL_T, boundCx, boundMaxZ + WALL_T * 0.5);
        addBoundWall(WALL_T, boundL, boundMinX - WALL_T * 0.5, boundCz);
        addBoundWall(WALL_T, boundL, boundMaxX + WALL_T * 0.5, boundCz);

        // Curved concrete tribune like indoor arena stands (blue seats + metal rails).
        const bleacherColliders = [];
        const seatSlots = [];
        const stairSteps = [];
        const aisleAngles = [];
        let walkPath = null;
        let tribuneMeta = null;
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0xc8ced6, roughness: 0.82, metalness: 0.04 });
        const concreteDark = new THREE.MeshStandardMaterial({ color: 0xaeb6c0, roughness: 0.85, metalness: 0.03 });
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x1f78e8, roughness: 0.42, metalness: 0.06 });
        const railMat = new THREE.MeshStandardMaterial({ color: 0xd7dde5, metalness: 0.78, roughness: 0.28 });

        function registerBleacherBox(x, y, z, hx, hy, hz, rest, kind) {
            bleacherColliders.push({
                minX: x - hx,
                maxX: x + hx,
                minY: y - hy,
                maxY: y + hy,
                minZ: z - hz,
                maxZ: z + hz,
                rest: rest,
                kind: kind || 'deck'
            });
        }

        function ellipsePoint(rx, rz, theta) {
            return {
                x: boundCx + Math.cos(theta) * rx,
                z: boundCz + Math.sin(theta) * rz,
                nx: Math.cos(theta),
                nz: Math.sin(theta)
            };
        }

        function addRailSegment(x1, y1, z1, x2, yOrZ2, z2Opt) {
            let y2;
            let z2;
            if (z2Opt === undefined) {
                y2 = y1;
                z2 = yOrZ2;
            } else {
                y2 = yOrZ2;
                z2 = z2Opt;
            }
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dz = z2 - z1;
            const len = Math.hypot(dx, dy, dz) || 0.01;
            const midX = (x1 + x2) * 0.5;
            const midY = (y1 + y2) * 0.5;
            const midZ = (z1 + z2) * 0.5;
            const bar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.022, 0.022, len, 6),
                railMat
            );
            bar.position.set(midX, midY, midZ);
            bar.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(dx / len, dy / len, dz / len)
            );
            scene.add(bar);
            registerBleacherBox(
                midX,
                midY,
                midZ,
                Math.max(0.04, Math.abs(dx) * 0.5 + 0.03),
                Math.max(0.04, Math.abs(dy) * 0.5 + 0.03),
                Math.max(0.04, Math.abs(dz) * 0.5 + 0.03),
                0.35,
                'rail'
            );
        }

        function makeEllipseRing(innerRx, innerRz, outerRx, outerRz, height, mat) {
            const pts = 96;
            const shape = new THREE.Shape();
            for (let i = 0; i <= pts; i += 1) {
                const t = (i / pts) * Math.PI * 2;
                const x = Math.cos(t) * outerRx;
                const y = Math.sin(t) * outerRz;
                if (i === 0) shape.moveTo(x, y);
                else shape.lineTo(x, y);
            }
            const hole = new THREE.Path();
            for (let i = 0; i <= pts; i += 1) {
                const t = -(i / pts) * Math.PI * 2;
                const x = Math.cos(t) * innerRx;
                const y = Math.sin(t) * innerRz;
                if (i === 0) hole.moveTo(x, y);
                else hole.lineTo(x, y);
            }
            shape.holes.push(hole);
            const geo = new THREE.ExtrudeGeometry(shape, {
                depth: height,
                bevelEnabled: false,
                curveSegments: 1
            });
            geo.rotateX(-Math.PI / 2);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(boundCx, 0, boundCz);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        }

        function registerRingColliders(innerRx, innerRz, outerRx, outerRz, y0, y1, rest) {
            const segs = 48;
            const midY = (y0 + y1) * 0.5;
            const hy = Math.max(0.05, (y1 - y0) * 0.5);
            for (let i = 0; i < segs; i += 1) {
                const theta = (i / segs) * Math.PI * 2;
                const rmX = (innerRx + outerRx) * 0.5;
                const rmZ = (innerRz + outerRz) * 0.5;
                const p = ellipsePoint(rmX, rmZ, theta);
                const depth = Math.max(outerRx - innerRx, outerRz - innerRz);
                const arc = (Math.PI * 2 * ((rmX + rmZ) * 0.5)) / segs;
                registerBleacherBox(p.x, midY, p.z, arc * 0.7, hy, depth * 0.55, rest);
            }
        }

        (function buildArenaTribune() {
            // Scale to real basketball (~24cm): game ball diameter is 0.36.
            const ballD = 0.36;
            const u = ballD / 0.24;
            const rows = 5;
            const rowDepth = 0.82 * u;
            const rowRise = 0.36 * u;
            const baseRx = boundW * 0.5 + WALL_T + 0.9 * u;
            const baseRz = boundL * 0.5 + WALL_T + 0.9 * u;
            const seatW = 0.50 * u;
            const seatD = 0.44 * u;
            const seatThick = 0.045 * u;
            const lipH = 0.16 * u;
            const seatPitch = 0.56 * u;
            const midCirc = Math.PI * (baseRx + baseRz + rows * rowDepth);
            const segments = Math.max(40, Math.round(midCirc / seatPitch));
            const aisleEvery = Math.max(7, Math.round((2.4 * u) / seatPitch));
            const railPostH = 1.05 * u;
            const railPostR = 0.035 * u;

            function placeLSeat(x, y, z, theta, nx, nz, row, seg) {
                const group = new THREE.Group();
                const plate = new THREE.Mesh(
                    new THREE.BoxGeometry(seatW, seatThick, seatD),
                    seatMat
                );
                plate.position.set(0, seatThick * 0.5, 0);
                group.add(plate);

                const lip = new THREE.Mesh(
                    new THREE.BoxGeometry(seatW, lipH, seatThick),
                    seatMat
                );
                lip.position.set(0, -lipH * 0.5 + seatThick * 0.2, seatD * 0.5 - seatThick * 0.2);
                group.add(lip);

                const flangeGeo = new THREE.BoxGeometry(seatThick * 0.7, seatThick * 1.1, seatD * 0.9);
                const fL = new THREE.Mesh(flangeGeo, seatMat);
                const fR = new THREE.Mesh(flangeGeo, seatMat);
                fL.position.set(-seatW * 0.48, seatThick * 0.35, 0);
                fR.position.set(seatW * 0.48, seatThick * 0.35, 0);
                group.add(fL, fR);

                group.position.set(x - nx * 0.04, y, z - nz * 0.04);
                group.rotation.y = Math.atan2(-nx, -nz);
                scene.add(group);
                registerBleacherBox(group.position.x, y + 0.06, group.position.z, seatW * 0.55, 0.14, seatD * 0.5, 0.55, 'seat');
                seatSlots.push({
                    x: group.position.x,
                    y: y + seatThick,
                    z: group.position.z,
                    rotY: group.rotation.y,
                    nx,
                    nz,
                    row,
                    seg,
                    theta
                });
            }

            const walkInnerRx = baseRx - 1.1 * u;
            const walkInnerRz = baseRz - 1.1 * u;
            const walk = makeEllipseRing(walkInnerRx, walkInnerRz, baseRx - 0.05, baseRz - 0.05, 0.18 * u, concreteDark);
            walk.position.y = 0;
            scene.add(walk);
            registerRingColliders(walkInnerRx, walkInnerRz, baseRx - 0.05, baseRz - 0.05, 0, 0.18 * u, 0.4);
            walkPath = {
                rx: (walkInnerRx + baseRx - 0.05) * 0.5,
                rz: (walkInnerRz + baseRz - 0.05) * 0.5,
                y: 0.18 * u,
                u
            };

            for (let i = 0; i < segments; i += 1) {
                const t0 = (i / segments) * Math.PI * 2;
                const t1 = ((i + 1) / segments) * Math.PI * 2;
                const a = ellipsePoint(baseRx - 0.95 * u, baseRz - 0.95 * u, t0);
                const b = ellipsePoint(baseRx - 0.95 * u, baseRz - 0.95 * u, t1);
                const post = new THREE.Mesh(new THREE.CylinderGeometry(railPostR, railPostR, railPostH * 0.85, 6), railMat);
                post.position.set(a.x, railPostH * 0.45, a.z);
                scene.add(post);
                registerBleacherBox(a.x, railPostH * 0.45, a.z, 0.05, railPostH * 0.4, 0.05, 0.35, 'rail');
                addRailSegment(a.x, railPostH * 0.8, a.z, b.x, b.z);
                addRailSegment(a.x, railPostH * 0.45, a.z, b.x, b.z);
            }

            for (let r = 0; r < rows; r += 1) {
                const topY = 0.22 * u + (r + 1) * rowRise;
                const innerRx = baseRx + r * rowDepth;
                const innerRz = baseRz + r * rowDepth;
                const outerRx = innerRx + rowDepth;
                const outerRz = innerRz + rowDepth;

                const bulk = makeEllipseRing(innerRx, innerRz, outerRx, outerRz, topY, concreteMat);
                scene.add(bulk);
                registerRingColliders(innerRx, innerRz, outerRx, outerRz, 0, topY, 0.42);

                const deck = makeEllipseRing(
                    innerRx + 0.02, innerRz + 0.02,
                    outerRx - 0.02, outerRz - 0.02,
                    0.08 * u, concreteDark
                );
                deck.position.y = topY;
                scene.add(deck);
                registerRingColliders(innerRx, innerRz, outerRx, outerRz, topY, topY + 0.08 * u, 0.45);

                for (let i = 0; i < segments; i += 1) {
                    const theta = (i / segments) * Math.PI * 2;
                    const midRx = (innerRx + outerRx) * 0.5;
                    const midRz = (innerRz + outerRz) * 0.5;
                    const p = ellipsePoint(midRx, midRz, theta);
                    const isAisle = (i % aisleEvery) === 0 || (i % aisleEvery) === 1;

                    if (isAisle) {
                        const step = new THREE.Mesh(
                            new THREE.BoxGeometry(0.55 * u, 0.12 * u, rowDepth * 0.55),
                            concreteDark
                        );
                        step.position.set(p.x + p.nx * 0.05, topY + 0.14 * u, p.z + p.nz * 0.05);
                        step.rotation.y = -theta;
                        scene.add(step);
                        registerBleacherBox(step.position.x, step.position.y, step.position.z, 0.3 * u, 0.07 * u, rowDepth * 0.28, 0.48, 'step');
                        stairSteps.push({
                            x: step.position.x,
                            y: step.position.y + 0.06 * u,
                            z: step.position.z,
                            row: r,
                            theta,
                            seg: i
                        });
                    } else {
                        placeLSeat(p.x - p.nx * 0.02, topY + 0.05 * u, p.z - p.nz * 0.02, theta, p.nx, p.nz, r, i);
                    }
                }
            }

            function buildAisleFence(segIndex) {
                const theta = (segIndex / segments) * Math.PI * 2;
                const posts = [];
                for (let r = 0; r < rows; r += 1) {
                    const deckY = 0.22 * u + (r + 1) * rowRise;
                    const midRx = baseRx + r * rowDepth + rowDepth * 0.5;
                    const midRz = baseRz + r * rowDepth + rowDepth * 0.5;
                    const p = ellipsePoint(midRx, midRz, theta);
                    const postH = railPostH;
                    const postY = deckY + postH * 0.5 + 0.06 * u;
                    const post = new THREE.Mesh(new THREE.CylinderGeometry(railPostR, railPostR, postH, 6), railMat);
                    post.position.set(p.x, postY, p.z);
                    scene.add(post);
                    registerBleacherBox(p.x, postY, p.z, 0.05, postH * 0.5, 0.05, 0.35, 'rail');
                    posts.push({
                        x: p.x, z: p.z,
                        top: deckY + postH + 0.04 * u,
                        mid: deckY + postH * 0.55,
                        low: deckY + 0.28 * u
                    });
                }
                for (let r = 0; r < posts.length - 1; r += 1) {
                    const aPost = posts[r];
                    const bPost = posts[r + 1];
                    addRailSegment(aPost.x, aPost.top, aPost.z, bPost.x, bPost.top, bPost.z);
                    addRailSegment(aPost.x, aPost.mid, aPost.z, bPost.x, bPost.mid, bPost.z);
                    addRailSegment(aPost.x, aPost.low, aPost.z, bPost.x, bPost.low, bPost.z);
                }
            }

            for (let a = 0; a < segments; a += aisleEvery) {
                buildAisleFence(a);
                buildAisleFence((a + 1) % segments);
                aisleAngles.push((a / segments) * Math.PI * 2);
                aisleAngles.push(((a + 1) / segments) * Math.PI * 2);
            }

            tribuneMeta = {
                u,
                rows,
                rowDepth,
                rowRise,
                baseRx,
                baseRz,
                segments,
                aisleEvery
            };

            const topInnerRx = baseRx + rows * rowDepth;
            const topInnerRz = baseRz + rows * rowDepth;
            const topOuterRx = topInnerRx + 1.2 * u;
            const topOuterRz = topInnerRz + 1.2 * u;
            const topY = 0.22 * u + rows * rowRise + 0.15 * u;
            const topBulk = makeEllipseRing(topInnerRx, topInnerRz, topOuterRx, topOuterRz, topY, concreteMat);
            scene.add(topBulk);
            registerRingColliders(topInnerRx, topInnerRz, topOuterRx, topOuterRz, 0, topY, 0.4);

            const topDeck = makeEllipseRing(
                topInnerRx + 0.02, topInnerRz + 0.02,
                topOuterRx - 0.02, topOuterRz - 0.02,
                0.1 * u, concreteDark
            );
            topDeck.position.y = topY;
            scene.add(topDeck);

            for (let i = 0; i < segments; i += 1) {
                const t0 = (i / segments) * Math.PI * 2;
                const t1 = ((i + 1) / segments) * Math.PI * 2;
                const a = ellipsePoint(topOuterRx - 0.2 * u, topOuterRz - 0.2 * u, t0);
                const b = ellipsePoint(topOuterRx - 0.2 * u, topOuterRz - 0.2 * u, t1);
                const post = new THREE.Mesh(new THREE.CylinderGeometry(railPostR, railPostR, railPostH, 6), railMat);
                post.position.set(a.x, topY + railPostH * 0.5, a.z);
                scene.add(post);
                registerBleacherBox(a.x, topY + railPostH * 0.5, a.z, 0.05, railPostH * 0.5, 0.05, 0.35, 'rail');
                addRailSegment(a.x, topY + railPostH * 0.9, a.z, b.x, b.z);
                addRailSegment(a.x, topY + railPostH * 0.5, a.z, b.x, b.z);
            }
        }());

        const spectators = [];
        const spectatorHitFx = [];
        const victoryConfetti = [];
        const CONFETTI_COLORS = [
            0xff3b5c, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf72585,
            0xffffff, 0xff9f1c, 0x9b5de5, 0x00f5d4, 0xfee440
        ];
        const SKIN_TONES = [0xe8c4a8, 0xc68642, 0x8d5524, 0xffdbac, 0xd4a574, 0xf1c27d];
        const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xffffff, 0x2c3e50];
        const PANTS_COLORS = [0x2c3e50, 0x34495e, 0x1a1a2e, 0x4a5568, 0x3d348b];

        function makeLimb(geo, mat, px, py, pz) {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(px, py, pz);
            mesh.castShadow = false;
            return mesh;
        }

        function createSpectator(scale) {
            const s = scale;
            const skin = new THREE.MeshStandardMaterial({
                color: SKIN_TONES[(Math.random() * SKIN_TONES.length) | 0],
                roughness: 0.88,
                metalness: 0.02
            });
            const shirt = new THREE.MeshStandardMaterial({
                color: SHIRT_COLORS[(Math.random() * SHIRT_COLORS.length) | 0],
                roughness: 0.72,
                metalness: 0.04
            });
            const pants = new THREE.MeshStandardMaterial({
                color: PANTS_COLORS[(Math.random() * PANTS_COLORS.length) | 0],
                roughness: 0.8,
                metalness: 0.03
            });

            const root = new THREE.Group();
            const hips = new THREE.Group();
            root.add(hips);

            const pelvis = makeLimb(new THREE.BoxGeometry(0.26 * s, 0.12 * s, 0.16 * s), pants, 0, 0.06 * s, 0);
            hips.add(pelvis);

            const torso = makeLimb(new THREE.BoxGeometry(0.3 * s, 0.36 * s, 0.18 * s), shirt, 0, 0.3 * s, 0);
            hips.add(torso);

            const head = makeLimb(new THREE.SphereGeometry(0.11 * s, 8, 8), skin, 0, 0.56 * s, 0.01 * s);
            hips.add(head);

            function makeArm(side) {
                const arm = new THREE.Group();
                arm.position.set(side * 0.18 * s, 0.42 * s, 0);
                const upper = makeLimb(new THREE.BoxGeometry(0.08 * s, 0.22 * s, 0.08 * s), shirt, 0, -0.1 * s, 0);
                const elbow = new THREE.Group();
                elbow.position.set(0, -0.22 * s, 0);
                const lower = makeLimb(new THREE.BoxGeometry(0.07 * s, 0.2 * s, 0.07 * s), skin, 0, -0.1 * s, 0);
                elbow.add(lower);
                arm.add(upper, elbow);
                hips.add(arm);
                return { root: arm, elbow };
            }

            function makeLeg(side) {
                const leg = new THREE.Group();
                leg.position.set(side * 0.08 * s, 0.02 * s, 0);
                const upper = makeLimb(new THREE.BoxGeometry(0.1 * s, 0.26 * s, 0.1 * s), pants, 0, -0.14 * s, 0);
                const knee = new THREE.Group();
                knee.position.set(0, -0.28 * s, 0);
                const lower = makeLimb(new THREE.BoxGeometry(0.09 * s, 0.24 * s, 0.09 * s), pants, 0, -0.12 * s, 0);
                const foot = makeLimb(
                    new THREE.BoxGeometry(0.1 * s, 0.05 * s, 0.16 * s),
                    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 }),
                    0,
                    -0.26 * s,
                    0.03 * s
                );
                knee.add(lower, foot);
                leg.add(upper, knee);
                hips.add(leg);
                return { root: leg, knee };
            }

            const armL = makeArm(-1);
            const armR = makeArm(1);
            const legL = makeLeg(-1);
            const legR = makeLeg(1);
            const joints = [hips, armL.root, armL.elbow, armR.root, armR.elbow, legL.root, legL.knee, legR.root, legR.knee, head];
            joints.forEach((j) => {
                j.userData.av = new THREE.Vector3();
            });

            return {
                root,
                hips,
                armL: armL.root,
                armR: armR.root,
                legL: legL.root,
                legR: legR.root,
                armLElbow: armL.elbow,
                armRElbow: armR.elbow,
                legLKnee: legL.knee,
                legRKnee: legR.knee,
                head,
                torso,
                joints,
                scale: s,
                mode: 'seated',
                seat: null,
                walkAngle: 0,
                walkSpeed: 0.35 + Math.random() * 0.25,
                walkDir: Math.random() < 0.5 ? 1 : -1,
                walkPhase: Math.random() * Math.PI * 2,
                walkTimer: 0,
                vel: new THREE.Vector3(),
                spin: new THREE.Vector3(),
                hitCooldown: 0,
                recoverT: 0,
                grounded: false,
                prevMode: 'seated',
                returnTarget: null,
                getUpT: 0,
                path: null,
                pathIndex: 0,
                pathWait: 0,
                pathLane: 0,
                cheerT: 0,
                cheerPhase: 0,
                cheerDelay: 0,
                angryT: 0,
                angryPhase: 0,
                angryPending: false,
                angryBubble: null,
                angryBubbleSwap: 0,
                radius: 0.22 * s,
                height: 1.15 * s
            };
        }

        function poseSeated(npc) {
            const s = npc.scale;
            npc.joints.forEach((j) => j.userData.av.set(0, 0, 0));
            npc.armL.rotation.set(0.35, 0, 0.45);
            npc.armR.rotation.set(0.35, 0, -0.45);
            npc.armLElbow.rotation.set(-0.55, 0, 0);
            npc.armRElbow.rotation.set(-0.55, 0, 0);
            npc.legL.rotation.set(-1.15, 0.08, 0.05);
            npc.legR.rotation.set(-1.15, -0.08, -0.05);
            npc.legLKnee.rotation.set(1.35, 0, 0);
            npc.legRKnee.rotation.set(1.35, 0, 0);
            npc.hips.rotation.set(0.12, 0, 0);
            npc.hips.position.y = 0.42 * s;
            npc.head.rotation.set(0, 0, 0);
            npc.root.rotation.x = 0;
            npc.root.rotation.z = 0;
            npc.grounded = false;
        }

        function poseStanding(npc) {
            npc.joints.forEach((j) => j.userData.av.set(0, 0, 0));
            npc.armL.rotation.set(0, 0, 0.12);
            npc.armR.rotation.set(0, 0, -0.12);
            npc.armLElbow.rotation.set(0, 0, 0);
            npc.armRElbow.rotation.set(0, 0, 0);
            npc.legL.rotation.set(0, 0, 0);
            npc.legR.rotation.set(0, 0, 0);
            npc.legLKnee.rotation.set(0, 0, 0);
            npc.legRKnee.rotation.set(0, 0, 0);
            npc.hips.rotation.set(0, 0, 0);
            npc.hips.position.y = 0.55 * npc.scale;
            npc.head.rotation.set(0, 0, 0);
            npc.root.rotation.x = 0;
            npc.root.rotation.z = 0;
            npc.grounded = false;
        }

        function placeSpectatorOnSeat(npc, seat) {
            npc.mode = 'seated';
            npc.seat = seat;
            npc.vel.set(0, 0, 0);
            npc.spin.set(0, 0, 0);
            npc.root.position.set(seat.x, seat.y, seat.z);
            npc.root.rotation.set(0, seat.rotY, 0);
            if (!(npc.cheerT > 0)) poseSeated(npc);
        }

        function triggerCrowdCheer() {
            for (let i = 0; i < spectators.length; i += 1) {
                const npc = spectators[i];
                if (npc.mode === 'ragdoll' || npc.mode === 'getting_up') continue;
                npc.cheerDelay = Math.random() * 0.4;
                npc.cheerT = 2.4 + Math.random() * 1.6;
                npc.cheerPhase = Math.random() * Math.PI * 2;
            }
        }

        function updateCheerPose(npc, dt) {
            if (npc.cheerDelay > 0) {
                npc.cheerDelay -= dt;
                return false;
            }
            if (!(npc.cheerT > 0)) return false;
            npc.cheerT -= dt;
            npc.cheerPhase += dt * (9.5 + (iHash(npc) % 5) * 0.35);
            const wave = Math.sin(npc.cheerPhase);
            const wave2 = Math.sin(npc.cheerPhase * 1.27 + 0.8);
            // Tangan ke atas, goyang — sorak.
            npc.armL.rotation.set(-2.15 + wave * 0.4, 0.15, 0.55 + wave * 0.3);
            npc.armR.rotation.set(-2.1 + wave2 * 0.4, -0.15, -0.55 - wave2 * 0.3);
            npc.armLElbow.rotation.set(-0.25 + wave * 0.15, 0, 0);
            npc.armRElbow.rotation.set(-0.25 + wave2 * 0.15, 0, 0);
            npc.head.rotation.y = wave * 0.28;
            npc.head.rotation.x = -0.18 + Math.abs(wave) * 0.1;
            if (npc.mode === 'seated') {
                npc.hips.position.y = 0.42 * npc.scale + Math.abs(wave) * 0.05;
                npc.hips.rotation.x = 0.08 + Math.abs(wave) * 0.06;
            } else if (npc.mode === 'walking' || npc.mode === 'returning') {
                npc.hips.position.y = 0.55 * npc.scale + Math.abs(wave) * 0.03;
            }
            if (npc.cheerT <= 0) {
                npc.cheerT = 0;
                if (npc.mode === 'seated') poseSeated(npc);
            }
            return true;
        }

        function iHash(npc) {
            return Math.abs(((npc.seat && npc.seat.row) || 0) * 17
                + Math.floor(((npc.seat && npc.seat.theta) || 0) * 100));
        }

        function spawnHitSpark(x, y, z) {
            const burst = new THREE.Group();
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffe14a,
                transparent: true,
                opacity: 0.95
            });
            for (let i = 0; i < 7; i += 1) {
                const bit = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), mat.clone());
                bit.position.set(0, 0, 0);
                bit.userData.v = new THREE.Vector3(
                    (Math.random() - 0.5) * 3.2,
                    1.2 + Math.random() * 2.4,
                    (Math.random() - 0.5) * 3.2
                );
                burst.add(bit);
            }
            burst.position.set(x, y, z);
            scene.add(burst);
            spectatorHitFx.push({ root: burst, life: 0.55 });
        }

        function randSpin(amount) {
            return (Math.random() - 0.5) * amount;
        }

        function knockSpectator(npc, impulse, hitPoint) {
            if (npc.hitCooldown > 0 || npc.mode === 'ragdoll') return;
            npc.prevMode = (npc.mode === 'returning' || npc.mode === 'getting_up' || npc.mode === 'angry')
                ? (npc.seat || npc.returnTarget ? 'seated' : 'walking')
                : npc.mode;
            if ((npc.mode === 'returning' || npc.mode === 'getting_up') && npc.returnTarget) {
                npc.seat = npc.returnTarget;
            }
            npc.hitCooldown = 0.35;
            npc.mode = 'ragdoll';
            npc.grounded = false;
            npc.path = null;
            npc.pathIndex = 0;
            npc.pathWait = 0;
            npc.getUpT = 0;
            npc.cheerT = 0;
            npc.cheerDelay = 0;
            npc.angryPending = true;
            npc.angryT = 0;
            npc.recoverT = 4.8 + Math.random() * 2.4;
            npc.vel.copy(impulse);
            npc.vel.y = Math.max(1.6, Math.abs(impulse.y) * 0.55 + 1.8);
            npc.spin.set(randSpin(3.2), randSpin(2.4), randSpin(3.2));
            npc.joints.forEach((j) => {
                j.userData.av.set(randSpin(22), randSpin(14), randSpin(22));
            });
            npc.armLElbow.userData.av.set(randSpin(26), randSpin(8), randSpin(10));
            npc.armRElbow.userData.av.set(randSpin(26), randSpin(8), randSpin(10));
            npc.legLKnee.userData.av.set(randSpin(20), randSpin(6), randSpin(8));
            npc.legRKnee.userData.av.set(randSpin(20), randSpin(6), randSpin(8));
            spawnHitSpark(hitPoint.x, hitPoint.y, hitPoint.z);
            clearAngryBubble(npc);
        }

        const ANGRY_EMOTES = ['💢', '😠', '>:(', '!!', '🤬', '💢!!'];

        function makeAngryBubbleTexture(emote) {
            const c = document.createElement('canvas');
            c.width = 256;
            c.height = 200;
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);

            const bx = 28;
            const by = 18;
            const bw = 200;
            const bh = 130;
            const r = 28;
            ctx.beginPath();
            ctx.moveTo(bx + r, by);
            ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
            ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
            ctx.lineTo(bx + bw * 0.42, by + bh);
            ctx.lineTo(bx + bw * 0.28, by + bh + 28);
            ctx.lineTo(bx + bw * 0.34, by + bh);
            ctx.arcTo(bx, by + bh, bx, by, r);
            ctx.arcTo(bx, by, bx + bw, by, r);
            ctx.closePath();
            ctx.fillStyle = '#fff8f0';
            ctx.fill();
            ctx.strokeStyle = '#1c1c1c';
            ctx.lineWidth = 7;
            ctx.stroke();

            // aksen marah
            ctx.fillStyle = '#e6322a';
            ctx.beginPath();
            ctx.arc(bx + bw - 22, by + 22, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#1a1a1a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const big = emote.length <= 2;
            ctx.font = big ? 'bold 78px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
                : 'bold 56px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.fillText(emote, bx + bw * 0.5, by + bh * 0.48);

            const tex = new THREE.CanvasTexture(c);
            if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
            return tex;
        }

        function clearAngryBubble(npc) {
            if (!npc.angryBubble) return;
            npc.root.remove(npc.angryBubble);
            if (npc.angryBubble.material) {
                if (npc.angryBubble.material.map) npc.angryBubble.material.map.dispose();
                npc.angryBubble.material.dispose();
            }
            npc.angryBubble = null;
            npc.angryBubbleSwap = 0;
        }

        function spawnAngryBubble(npc) {
            clearAngryBubble(npc);
            const emote = ANGRY_EMOTES[(Math.random() * ANGRY_EMOTES.length) | 0];
            const mat = new THREE.SpriteMaterial({
                map: makeAngryBubbleTexture(emote),
                transparent: true,
                depthTest: true,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(mat);
            const s = 0.7 * npc.scale;
            sprite.scale.set(s * 1.15, s * 0.9, 1);
            sprite.position.set(0.08 * npc.scale, npc.height * 1.08, 0.12 * npc.scale);
            npc.root.add(sprite);
            npc.angryBubble = sprite;
            npc.angryBubbleSwap = 0.65 + Math.random() * 0.25;
        }

        function refreshAngryBubbleEmote(npc) {
            if (!npc.angryBubble || !npc.angryBubble.material) return;
            const emote = ANGRY_EMOTES[(Math.random() * ANGRY_EMOTES.length) | 0];
            const old = npc.angryBubble.material.map;
            npc.angryBubble.material.map = makeAngryBubbleTexture(emote);
            npc.angryBubble.material.needsUpdate = true;
            if (old) old.dispose();
        }

        function angDist(a, b) {
            let d = Math.abs(a - b) % (Math.PI * 2);
            if (d > Math.PI) d = Math.PI * 2 - d;
            return d;
        }

        function nearestAisleThetaFrom(startAng, seatAng, startRow, seatRow, laneOffset) {
            if (!aisleAngles.length) return seatAng;
            const meta = tribuneMeta;
            const walkR = walkPath ? (walkPath.rx + walkPath.rz) * 0.5 : 8;
            const rowR = meta
                ? meta.baseRx + (seatRow + 0.5) * meta.rowDepth
                : walkR + 2;
            const stepCost = meta ? meta.rowDepth * 1.35 + meta.rowRise * 2.2 : 2.5;
            const ranked = [];
            for (let i = 0; i < aisleAngles.length; i += 1) {
                const a = aisleAngles[i];
                const toAisle = angDist(startAng, a) * walkR;
                const down = Math.max(0, (startRow + 1)) * stepCost;
                const up = Math.max(0, (seatRow + 1)) * stepCost;
                const along = angDist(a, seatAng) * rowR;
                ranked.push({ a, score: toAisle + down + up + along });
            }
            ranked.sort((x, y) => x.score - y.score);
            const pick = (laneOffset || 0) % ranked.length;
            return ranked[pick].a;
        }

        function estimateRowFromY(y) {
            if (!tribuneMeta) return 0;
            const { u, rowRise, rows } = tribuneMeta;
            const base = 0.22 * u + rowRise;
            if (y <= base * 0.85) return -1;
            const r = Math.round((y - 0.22 * u) / rowRise) - 1;
            return Math.max(-1, Math.min(rows - 1, r));
        }

        function pushArcWaypoints(out, fromAng, toAng, rx, rz, y, steps) {
            let delta = toAng - fromAng;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            const n = Math.max(2, steps || Math.ceil(Math.abs(delta) / 0.22));
            for (let i = 1; i <= n; i += 1) {
                const a = fromAng + (delta * i) / n;
                const p = ellipsePoint(rx, rz, a);
                out.push({ x: p.x, y, z: p.z, climb: false, pause: 0.04 });
            }
        }

        function buildReturnPath(npc, seat) {
            const path = [];
            const meta = tribuneMeta;
            const startAng = Math.atan2(npc.root.position.z - boundCz, npc.root.position.x - boundCx);
            const seatAng = seat.theta != null
                ? seat.theta
                : Math.atan2(seat.z - boundCz, seat.x - boundCx);
            const seatRow = seat.row != null ? seat.row : 0;
            const startRow = estimateRowFromY(npc.root.position.y);
            const aisleAng = nearestAisleThetaFrom(
                startAng, seatAng, Math.max(0, startRow), seatRow, npc.pathLane || 0
            );
            const walkY = walkPath ? walkPath.y : 0.2;
            const wrx = walkPath ? walkPath.rx : (meta ? meta.baseRx : 8);
            const wrz = walkPath ? walkPath.rz : (meta ? meta.baseRz : 8);

            function rowRadii(row) {
                if (!meta) return { rx: wrx, rz: wrz, y: walkY };
                return {
                    rx: meta.baseRx + row * meta.rowDepth + meta.rowDepth * 0.5,
                    rz: meta.baseRz + row * meta.rowDepth + meta.rowDepth * 0.5,
                    y: 0.22 * meta.u + (row + 1) * meta.rowRise + 0.05 * meta.u
                };
            }

            function pushStep(row) {
                const step = stairSteps.find((st) => st.row === row && angDist(st.theta, aisleAng) < 0.3);
                if (step) {
                    path.push({
                        x: step.x,
                        y: step.y,
                        z: step.z,
                        climb: true,
                        pause: 0
                    });
                    return;
                }
                const rr = rowRadii(row);
                const p = ellipsePoint(rr.rx, rr.rz, aisleAng);
                path.push({
                    x: p.x,
                    y: rr.y + 0.08,
                    z: p.z,
                    climb: true,
                    pause: 0
                });
            }

            function angStepToward(from, to, step) {
                let delta = to - from;
                while (delta > Math.PI) delta -= Math.PI * 2;
                while (delta < -Math.PI) delta += Math.PI * 2;
                if (Math.abs(delta) <= step) return to;
                return from + Math.sign(delta) * step;
            }

            // Kasus terdekat: sudah di baris yang sama → hanya menyusuri baris.
            if (startRow === seatRow && startRow >= 0) {
                const rr = rowRadii(seatRow);
                // Hindari menempel pagar: mulai sedikit menjauh dari sudut lorong.
                const fromAng = angDist(startAng, aisleAng) < 0.12
                    ? angStepToward(aisleAng, seatAng, 0.1)
                    : startAng;
                pushArcWaypoints(path, fromAng, seatAng, rr.rx, rr.rz, seat.y, 0);
                path.push({
                    x: seat.x, y: seat.y, z: seat.z, climb: false, pause: 0.4, sit: true
                });
                return path;
            }

            if (startRow >= 0) {
                const rr0 = rowRadii(startRow);
                // Menuju lorong tapi berhenti sebelum pagar (offset sudut).
                const approach = angStepToward(aisleAng, startAng, 0.12);
                pushArcWaypoints(
                    path, startAng, approach, rr0.rx, rr0.rz,
                    Math.max(npc.root.position.y, rr0.y), 0
                );
                if (startRow > seatRow) {
                    for (let r = startRow; r > seatRow; r -= 1) pushStep(r);
                    pushStep(seatRow);
                } else {
                    for (let r = startRow + 1; r <= seatRow; r += 1) pushStep(r);
                }
            } else {
                const onWalk = ellipsePoint(wrx, wrz, startAng);
                path.push({ x: onWalk.x, y: walkY, z: onWalk.z, climb: false, pause: 0.15 });
                pushArcWaypoints(path, startAng, aisleAng, wrx, wrz, walkY, 0);
                for (let r = 0; r <= seatRow; r += 1) pushStep(r);
            }

            const rrSeat = rowRadii(seatRow);
            // Dari tangga masuk baris di sisi kursi (bukan di garis pagar).
            const enterAng = angStepToward(aisleAng, seatAng, 0.12);
            const enterPt = ellipsePoint(rrSeat.rx, rrSeat.rz, enterAng);
            path.push({
                x: enterPt.x, y: seat.y, z: enterPt.z, climb: false, pause: 0.08
            });
            pushArcWaypoints(path, enterAng, seatAng, rrSeat.rx, rrSeat.rz, seat.y, 0);
            path.push({
                x: seat.x, y: seat.y, z: seat.z, climb: false, pause: 0.45, sit: true
            });
            return path;
        }

        function sampleSupportY(x, z) {
            let y = 0.02;
            const pad = 0.38;
            for (let i = 0; i < seatSlots.length; i += 1) {
                const seat = seatSlots[i];
                const dx = x - seat.x;
                const dz = z - seat.z;
                if (dx * dx + dz * dz < pad * pad) y = Math.max(y, seat.y);
            }
            for (let i = 0; i < stairSteps.length; i += 1) {
                const st = stairSteps[i];
                const dx = x - st.x;
                const dz = z - st.z;
                if (dx * dx + dz * dz < (pad * 1.1) * (pad * 1.1)) y = Math.max(y, st.y);
            }
            if (walkPath) {
                const ang = Math.atan2(z - boundCz, x - boundCx);
                const er = ellipsePoint(walkPath.rx, walkPath.rz, ang);
                const dx = x - er.x;
                const dz = z - er.z;
                if (dx * dx + dz * dz < (1.15) * (1.15)) y = Math.max(y, walkPath.y);
            }
            if (tribuneMeta) {
                const { u, rows, rowDepth, rowRise, baseRx, baseRz } = tribuneMeta;
                const ang = Math.atan2(z - boundCz, x - boundCx);
                const c = Math.cos(ang);
                const s = Math.sin(ang);
                const pr = Math.hypot(x - boundCx, z - boundCz);
                for (let r = 0; r < rows; r += 1) {
                    const innerRx = baseRx + r * rowDepth;
                    const innerRz = baseRz + r * rowDepth;
                    const outerRx = innerRx + rowDepth;
                    const outerRz = innerRz + rowDepth;
                    const rIn = (innerRx * innerRz) / Math.sqrt((innerRz * c) ** 2 + (innerRx * s) ** 2);
                    const rOut = (outerRx * outerRz) / Math.sqrt((outerRz * c) ** 2 + (outerRx * s) ** 2);
                    if (pr >= rIn - 0.15 && pr <= rOut + 0.15) {
                        const topY = 0.22 * u + (r + 1) * rowRise;
                        y = Math.max(y, topY);
                    }
                }
            }
            for (let i = 0; i < bleacherColliders.length; i += 1) {
                const box = bleacherColliders[i];
                if (box.kind === 'rail') continue;
                if (x >= box.minX - 0.2 && x <= box.maxX + 0.2 && z >= box.minZ - 0.2 && z <= box.maxZ + 0.2) {
                    y = Math.max(y, box.maxY);
                }
            }
            return y;
        }

        function constrainNpcToTribune(npc, soft) {
            const p = npc.root.position;
            const support = sampleSupportY(p.x, p.z);
            if (p.y < support) {
                p.y = support;
                if (npc.vel) {
                    if (npc.vel.y < 0) npc.vel.y *= soft ? -0.05 : -0.12;
                    npc.vel.x *= 0.78;
                    npc.vel.z *= 0.78;
                }
                return true;
            }
            if (p.y < 0.02) {
                p.y = 0.02;
                return true;
            }
            return p.y <= support + 0.06;
        }

        function resolveNpcSolidBoxes(npc) {
            const p = npc.root.position;
            const r = Math.max(0.16, npc.radius * 1.05);
            const bodyY = p.y + npc.height * 0.22;
            for (let i = 0; i < bleacherColliders.length; i += 1) {
                const box = bleacherColliders[i];
                // Pagar/rail diabaikan NPC — penyebab utama stack di lorong.
                if (box.kind === 'rail') continue;
                // Jangan dorong keluar dari atas deck — itu support surface.
                if (p.y >= box.maxY - 0.05 && p.y <= box.maxY + 0.7
                    && p.x >= box.minX - r && p.x <= box.maxX + r
                    && p.z >= box.minZ - r && p.z <= box.maxZ + r) {
                    continue;
                }
                const cx = Math.max(box.minX, Math.min(p.x, box.maxX));
                const cy = Math.max(box.minY, Math.min(bodyY, box.maxY));
                const cz = Math.max(box.minZ, Math.min(p.z, box.maxZ));
                let dx = p.x - cx;
                let dy = bodyY - cy;
                let dz = p.z - cz;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq >= r * r || distSq < 1e-12) continue;
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;
                const push = r - dist;
                if (ny > 0.55) {
                    p.y = Math.max(p.y, box.maxY);
                    if (npc.vel && npc.vel.y < 0) npc.vel.y *= -0.08;
                } else {
                    p.x += nx * push;
                    p.z += nz * push;
                    p.y += ny * push * 0.25;
                    if (npc.vel) {
                        const vn = npc.vel.x * nx + npc.vel.y * ny + npc.vel.z * nz;
                        if (vn < 0) {
                            npc.vel.x -= 1.25 * vn * nx;
                            npc.vel.y -= 1.05 * vn * ny;
                            npc.vel.z -= 1.25 * vn * nz;
                        }
                    }
                }
            }
        }

        function resolveRagdollTribune(npc, dt) {
            resolveNpcSolidBoxes(npc);
            const grounded = constrainNpcToTribune(npc, false);
            if (grounded) {
                npc.grounded = true;
                npc.vel.x *= 0.7;
                npc.vel.z *= 0.7;
                npc.spin.multiplyScalar(0.55);
                const flop = npc.root.rotation.x >= 0 ? 1.35 : -1.35;
                npc.root.rotation.x += (flop - npc.root.rotation.x) * Math.min(1, 4.5 * dt);
                npc.root.rotation.z += (0 - npc.root.rotation.z) * Math.min(1, 2.2 * dt);
                for (let j = 0; j < npc.joints.length; j += 1) {
                    const joint = npc.joints[j];
                    if (!joint.userData.av) continue;
                    joint.userData.av.x += randSpin(5) * dt * 14;
                    joint.userData.av.z += randSpin(4) * dt * 12;
                }
            } else {
                npc.grounded = false;
            }
            // Sub-sample kaki kiri/kanan agar tidak tembus sambil rebah.
            const yaw = npc.root.rotation.y;
            const foot = 0.2 * npc.scale;
            const fx = Math.sin(yaw) * foot;
            const fz = Math.cos(yaw) * foot;
            const yL = sampleSupportY(npc.root.position.x - fx, npc.root.position.z - fz);
            const yR = sampleSupportY(npc.root.position.x + fx, npc.root.position.z + fz);
            const yC = sampleSupportY(npc.root.position.x, npc.root.position.z);
            const floorY = Math.max(yL, yR, yC);
            if (npc.root.position.y < floorY) {
                npc.root.position.y = floorY;
                if (npc.vel.y < 0) npc.vel.y *= -0.06;
                npc.grounded = true;
            }
        }

        function nearestAisleTheta(theta) {
            return nearestAisleThetaFrom(theta, theta, 0, 0);
        }

        function getUpAfterFall(npc) {
            npc.vel.set(0, 0, 0);
            npc.spin.set(0, 0, 0);
            npc.mode = 'getting_up';
            npc.getUpT = 2.4 + Math.random() * 1.2;
            npc.path = null;
            npc.pathIndex = 0;
            npc.pathWait = 0;
        }

        function resumeAfterAngry(npc) {
            clearAngryBubble(npc);
            if (npc.prevMode === 'seated' || npc.prevMode === 'returning' || npc.prevMode === 'getting_up') {
                const seat = npc.seat || npc.returnTarget;
                if (seat) {
                    npc.seat = seat;
                    npc.returnTarget = seat;
                    assignReturnLane(npc);
                    npc.path = buildReturnPath(npc, seat);
                    npc.pathIndex = 0;
                    npc.mode = 'returning';
                    return;
                }
            }

            npc.mode = 'walking';
            npc.walkTimer = 8 + Math.random() * 10;
            npc.walkDir = Math.random() < 0.5 ? 1 : -1;
            if (walkPath) {
                npc.walkAngle = Math.atan2(npc.root.position.z - boundCz, npc.root.position.x - boundCx);
                npc.root.position.y = walkPath.y;
            }
        }

        function finishGetUp(npc) {
            npc.root.rotation.x = 0;
            npc.root.rotation.z = 0;
            poseStanding(npc);

            if (npc.angryPending) {
                npc.angryPending = false;
                npc.mode = 'angry';
                npc.angryT = 2.8 + Math.random() * 1.8;
                npc.angryPhase = Math.random() * Math.PI * 2;
                faceDirection(npc, -npc.root.position.x, HOOP_Z - npc.root.position.z);
                spawnAngryBubble(npc);
                return;
            }

            resumeAfterAngry(npc);
        }

        function updateAngryNpc(npc, dt) {
            npc.angryT -= dt;
            npc.angryPhase += dt * 13.5;
            const shake = Math.sin(npc.angryPhase);
            const shake2 = Math.sin(npc.angryPhase * 1.65 + 0.4);
            const punch = Math.max(0, Math.sin(npc.angryPhase * 0.85));
            // Tinju goyang / gestur marah ke arah lapangan.
            npc.armL.rotation.set(-1.55 + shake * 0.65, 0.35, 0.95 + punch * 0.25);
            npc.armR.rotation.set(-1.5 + shake2 * 0.65, -0.35, -0.95 - punch * 0.25);
            npc.armLElbow.rotation.set(-1.15 + shake * 0.2, 0, 0);
            npc.armRElbow.rotation.set(-1.1 + shake2 * 0.2, 0, 0);
            npc.head.rotation.set(0.2, shake * 0.55, shake * 0.12);
            npc.hips.rotation.set(0.05, 0, shake * 0.1);
            npc.hips.position.y = 0.55 * npc.scale + Math.abs(shake) * 0.07;
            npc.legL.rotation.set(Math.abs(shake) * 0.2, 0.05, 0.04);
            npc.legR.rotation.set(Math.abs(shake2) * 0.18, -0.05, -0.04);
            npc.legLKnee.rotation.set(0.15, 0, 0);
            npc.legRKnee.rotation.set(0.12, 0, 0);
            faceDirection(npc, -npc.root.position.x, HOOP_Z - npc.root.position.z);
            constrainNpcToTribune(npc, true);

            if (npc.angryBubble) {
                const bob = 1 + Math.sin(npc.angryPhase * 0.9) * 0.08;
                const base = 0.7 * npc.scale;
                npc.angryBubble.scale.set(base * 1.15 * bob, base * 0.9 * bob, 1);
                npc.angryBubble.position.y = npc.height * 1.08 + Math.abs(Math.sin(npc.angryPhase)) * 0.06;
                npc.angryBubble.material.opacity = Math.min(1, npc.angryT * 1.4);
                npc.angryBubbleSwap -= dt;
                if (npc.angryBubbleSwap <= 0) {
                    refreshAngryBubbleEmote(npc);
                    npc.angryBubbleSwap = 0.55 + Math.random() * 0.35;
                }
            }

            if (npc.angryT <= 0) {
                npc.angryT = 0;
                resumeAfterAngry(npc);
            }
        }

        function updateGettingUp(npc, dt) {
            npc.getUpT -= dt;
            const t = 1 - Math.max(0, npc.getUpT) / 3.2;
            // Bangun pelan: dari rebah → bertumpu → berdiri.
            const lean = Math.max(0, 1.1 - t * 1.35);
            npc.root.rotation.x = npc.root.rotation.x >= 0 ? lean : -lean;
            npc.root.rotation.z *= 0.9;
            npc.armL.rotation.set(-0.4 + t * 0.5, 0, 0.6 - t * 0.4);
            npc.armR.rotation.set(-0.4 + t * 0.5, 0, -0.6 + t * 0.4);
            npc.legL.rotation.x = -0.3 + t * 0.3;
            npc.legR.rotation.x = -0.15 + t * 0.15;
            if (npc.getUpT <= 0) finishGetUp(npc);
        }

        function faceDirection(npc, dx, dz) {
            if (Math.hypot(dx, dz) < 1e-5) return;
            npc.root.rotation.x = 0;
            npc.root.rotation.z = 0;
            // Model menghadap +Z lokal → yaw dari vektor gerak horizontal.
            npc.root.rotation.y = Math.atan2(dx, dz);
        }

        function faceEllipseTangent(npc, rx, rz, theta, dir) {
            // Turunan ellipse: arah gerak sebenarnya (bukan θ ± 90° yang bikin miring).
            const d = dir >= 0 ? 1 : -1;
            const tx = -rx * Math.sin(theta) * d;
            const tz = rz * Math.cos(theta) * d;
            faceDirection(npc, tx, tz);
        }

        function separateActiveNpcs(npc) {
            // Returning / getting_up / angry tembus semua NPC.
            if (npc.mode === 'returning' || npc.mode === 'getting_up' || npc.mode === 'angry') return;
            const minDist = 0.32 * npc.scale;
            const p = npc.root.position;
            for (let i = 0; i < spectators.length; i += 1) {
                const other = spectators[i];
                if (other === npc) continue;
                if (other.mode === 'seated' || other.mode === 'ragdoll') continue;
                // Walker juga tembus orang yang sedang pulang.
                if (other.mode === 'returning' || other.mode === 'getting_up' || other.mode === 'angry') continue;
                const ox = other.root.position.x - p.x;
                const oz = other.root.position.z - p.z;
                const d = Math.hypot(ox, oz);
                if (d < 1e-4 || d >= minDist) continue;
                const push = (minDist - d) * 0.5;
                p.x -= (ox / d) * push * 0.5;
                p.z -= (oz / d) * push * 0.5;
            }
        }

        function offsetWaypoint(npc, wp) {
            // Path akurat ke kursi — tanpa offset lane (lane hanya untuk sebar aisle).
            return wp;
        }

        function assignReturnLane(npc) {
            let lane = 0;
            for (let i = 0; i < spectators.length; i += 1) {
                const other = spectators[i];
                if (other === npc) continue;
                if (other.mode === 'returning' || other.mode === 'getting_up') lane += 1;
            }
            npc.pathLane = lane % Math.max(1, aisleAngles.length || 4);
            npc.pathWait = 0;
        }

        function updateReturningNpc(npc, dt) {
            const seat = npc.returnTarget || npc.seat;
            if (!seat) {
                npc.mode = 'walking';
                return;
            }
            if (!npc.path || !npc.path.length) {
                if (npc.pathLane == null) assignReturnLane(npc);
                npc.path = buildReturnPath(npc, seat);
                npc.pathIndex = 0;
                npc.pathWait = 0;
                npc.stuckT = 0;
                npc.stuckPos = null;
            }

            if (npc.pathIndex >= npc.path.length) {
                placeSpectatorOnSeat(npc, seat);
                npc.returnTarget = null;
                npc.path = null;
                npc.pathLane = 0;
                return;
            }

            const rawWp = npc.path[npc.pathIndex];
            const wp = offsetWaypoint(npc, rawWp);
            const dx = wp.x - npc.root.position.x;
            const dy = wp.y - npc.root.position.y;
            const dz = wp.z - npc.root.position.z;
            const dist = Math.hypot(dx, dz);
            const climb = !!wp.climb || Math.abs(dy) > 0.08;
            const speed = (climb ? 0.95 : 1.35) * npc.scale;
            const arrive = climb ? 0.3 * npc.scale : 0.36 * npc.scale;

            // Deteksi jalan di tempat → loncat ke waypoint berikutnya.
            if (!npc.stuckPos) {
                npc.stuckPos = { x: npc.root.position.x, z: npc.root.position.z };
                npc.stuckT = 0;
            } else {
                const moved = Math.hypot(
                    npc.root.position.x - npc.stuckPos.x,
                    npc.root.position.z - npc.stuckPos.z
                );
                if (moved < 0.04 * npc.scale) npc.stuckT += dt;
                else {
                    npc.stuckPos.x = npc.root.position.x;
                    npc.stuckPos.z = npc.root.position.z;
                    npc.stuckT = 0;
                }
                if (npc.stuckT > 0.55) {
                    npc.root.position.set(wp.x, wp.y, wp.z);
                    npc.pathIndex += 1;
                    npc.stuckT = 0;
                    npc.stuckPos = null;
                    if (rawWp.sit || npc.pathIndex >= npc.path.length) {
                        placeSpectatorOnSeat(npc, seat);
                        npc.returnTarget = null;
                        npc.path = null;
                        npc.pathLane = 0;
                    }
                    return;
                }
            }

            if (dist < arrive && Math.abs(dy) < 0.28) {
                npc.root.position.y = wp.y;
                npc.pathIndex += 1;
                npc.stuckT = 0;
                npc.stuckPos = null;
                if (rawWp.sit) {
                    placeSpectatorOnSeat(npc, seat);
                    npc.returnTarget = null;
                    npc.path = null;
                    npc.pathLane = 0;
                }
                return;
            }

            if (dist > 1e-4) {
                const step = speed * dt;
                const move = Math.min(step, dist);
                npc.root.position.x += (dx / dist) * move;
                npc.root.position.z += (dz / dist) * move;
                faceDirection(npc, dx, dz);
            }
            if (climb) {
                const climbStep = 1.35 * npc.scale * dt;
                if (Math.abs(dy) <= climbStep) npc.root.position.y = wp.y;
                else npc.root.position.y += Math.sign(dy) * climbStep;
            } else {
                // Ikuti path Y; floor support hanya sebagai floor, bukan blok.
                const support = sampleSupportY(npc.root.position.x, npc.root.position.z);
                const targetY = Math.max(wp.y, support);
                npc.root.position.y += (targetY - npc.root.position.y) * Math.min(1, 3.2 * dt);
            }
            // Tidak resolve solid / separate — tembus geometry & NPC saat pulang.

            npc.walkPhase += dt * (climb ? 5.6 : 7.8);
            const swing = Math.sin(npc.walkPhase);
            if (climb) {
                npc.legL.rotation.x = swing * 0.95 + 0.45;
                npc.legR.rotation.x = -swing * 0.95 + 0.25;
                npc.legLKnee.rotation.x = 0.7 + Math.max(0, -swing) * 0.5;
                npc.legRKnee.rotation.x = 0.7 + Math.max(0, swing) * 0.5;
                npc.armL.rotation.x = -0.5 + swing * 0.35;
                npc.armR.rotation.x = -0.35 - swing * 0.35;
                npc.hips.position.y = 0.55 * npc.scale + Math.abs(swing) * 0.04;
            } else {
                npc.legL.rotation.x = swing * 0.55;
                npc.legR.rotation.x = -swing * 0.55;
                npc.legLKnee.rotation.x = 0;
                npc.legRKnee.rotation.x = 0;
                npc.armL.rotation.x = -swing * 0.7;
                npc.armR.rotation.x = swing * 0.7;
                npc.hips.position.y = 0.55 * npc.scale;
            }
            updateCheerPose(npc, dt);
        }

        (function buildSpectators() {
            if (!seatSlots.length) return;
            const s = (walkPath && walkPath.u) || 1.5;
            for (let i = 0; i < seatSlots.length; i += 1) {
                const npc = createSpectator(s * 0.92);
                placeSpectatorOnSeat(npc, seatSlots[i]);
                scene.add(npc.root);
                spectators.push(npc);
            }
            // Minimal 2 orang jalan dari bangku yang lurus kamera → 2 bangku kosong di depan view.
            if (walkPath && spectators.length) {
                const lookDir = new THREE.Vector3().subVectors(lookHome, camHome).normalize();
                const ranked = spectators.map((npc) => {
                    const seat = npc.seat;
                    const to = new THREE.Vector3(
                        seat.x - camHome.x,
                        (seat.y + 0.6) - camHome.y,
                        seat.z - camHome.z
                    );
                    const dist = to.length();
                    const align = dist > 0.01 ? to.normalize().dot(lookDir) : -1;
                    const score = align * 3 - Math.abs(dist - 16) * 0.04;
                    return { npc, score, align, dist };
                }).filter((row) => row.align > 0.55)
                    .sort((a, b) => b.score - a.score);

                let pool = ranked;
                if (pool.length < 2) {
                    pool = spectators.map((npc) => {
                        const seat = npc.seat;
                        const to = new THREE.Vector3(seat.x - camHome.x, seat.y - camHome.y, seat.z - camHome.z);
                        const dist = to.length();
                        const align = dist > 0.01 ? to.clone().normalize().dot(lookDir) : -1;
                        return { npc, score: align, align, dist };
                    }).sort((a, b) => b.score - a.score);
                }

                const walkCount = Math.max(2, Math.min(4, pool.length));
                for (let w = 0; w < walkCount; w += 1) {
                    const npc = pool[w].npc;
                    if (npc.mode !== 'seated') continue;
                    npc.mode = 'walking';
                    npc.cameraLine = true;
                    npc.walkAngle = Math.atan2(npc.root.position.z - boundCz, npc.root.position.x - boundCx);
                    npc.walkDir = Math.random() < 0.5 ? 1 : -1;
                    npc.walkTimer = 14 + Math.random() * 10;
                    poseStanding(npc);
                    const p = ellipsePoint(walkPath.rx, walkPath.rz, npc.walkAngle);
                    npc.root.position.set(p.x, walkPath.y, p.z);
                }
            }
        }());

        function startRandomWalker() {
            if (!walkPath) return;
            const seated = spectators.filter((n) => n.mode === 'seated');
            if (!seated.length) return;
            const npc = seated[(Math.random() * seated.length) | 0];
            npc.mode = 'walking';
            // Keep home seat so after a fall they can walk back.
            npc.walkAngle = Math.atan2(npc.root.position.z - boundCz, npc.root.position.x - boundCx);
            npc.walkDir = Math.random() < 0.5 ? 1 : -1;
            npc.walkTimer = 6 + Math.random() * 10;
            poseStanding(npc);
            const p = ellipsePoint(walkPath.rx, walkPath.rz, npc.walkAngle);
            npc.root.position.set(p.x, walkPath.y, p.z);
        }

        function returnToNearestSeat(npc) {
            if (!seatSlots.length) {
                npc.mode = 'walking';
                return;
            }
            let best = seatSlots[0];
            let bestD = Infinity;
            for (let i = 0; i < seatSlots.length; i += 1) {
                const seat = seatSlots[i];
                const d = (seat.x - npc.root.position.x) ** 2 + (seat.z - npc.root.position.z) ** 2;
                if (d < bestD) {
                    bestD = d;
                    best = seat;
                }
            }
            placeSpectatorOnSeat(npc, best);
        }

        function updateSpectatorHitFx(dt) {
            for (let i = spectatorHitFx.length - 1; i >= 0; i -= 1) {
                const fx = spectatorHitFx[i];
                fx.life -= dt;
                fx.root.children.forEach((bit) => {
                    bit.position.x += bit.userData.v.x * dt;
                    bit.position.y += bit.userData.v.y * dt;
                    bit.position.z += bit.userData.v.z * dt;
                    bit.userData.v.y -= 6 * dt;
                    if (bit.material && bit.material.opacity !== undefined) {
                        bit.material.opacity = Math.max(0, fx.life / 0.55);
                    }
                });
                if (fx.life <= 0) {
                    scene.remove(fx.root);
                    spectatorHitFx.splice(i, 1);
                }
            }
        }

        function clearVictoryConfetti() {
            for (let i = 0; i < victoryConfetti.length; i += 1) {
                const piece = victoryConfetti[i];
                scene.remove(piece.mesh);
                if (piece.mesh.geometry) piece.mesh.geometry.dispose();
                if (piece.mesh.material) piece.mesh.material.dispose();
            }
            victoryConfetti.length = 0;
        }

        function spawnVictoryConfetti() {
            clearVictoryConfetti();
            const count = 96;
            for (let i = 0; i < count; i += 1) {
                const w = 0.05 + Math.random() * 0.11;
                const h = 0.03 + Math.random() * 0.09;
                const mesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(w, h),
                    new THREE.MeshBasicMaterial({
                        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.95,
                        depthWrite: false
                    })
                );
                // Sebaran di atas ring / setengah lapangan menghadap kamera.
                const burst = i < 40;
                mesh.position.set(
                    burst ? (Math.random() - 0.5) * 2.4 : (Math.random() - 0.5) * 7.5,
                    burst ? rimY + 0.6 + Math.random() * 1.8 : 3.2 + Math.random() * 2.8,
                    burst ? rimZ + (Math.random() - 0.5) * 1.6 : boundCz + (Math.random() - 0.5) * 5
                );
                mesh.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                scene.add(mesh);
                victoryConfetti.push({
                    mesh,
                    vel: new THREE.Vector3(
                        (Math.random() - 0.5) * (burst ? 3.4 : 1.6),
                        burst ? 1.2 + Math.random() * 2.8 : 0.2 + Math.random() * 0.8,
                        (Math.random() - 0.5) * (burst ? 2.8 : 1.2) + (burst ? 0.6 : 0)
                    ),
                    spin: new THREE.Vector3(
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 12,
                        (Math.random() - 0.5) * 10
                    ),
                    life: 3.2 + Math.random() * 2.2,
                    maxLife: 4.5
                });
            }
        }

        function updateVictoryConfetti(dt) {
            for (let i = victoryConfetti.length - 1; i >= 0; i -= 1) {
                const p = victoryConfetti[i];
                p.life -= dt;
                p.vel.y -= 5.2 * dt;
                p.vel.x *= 0.992;
                p.vel.z *= 0.992;
                p.mesh.position.x += p.vel.x * dt;
                p.mesh.position.y += p.vel.y * dt;
                p.mesh.position.z += p.vel.z * dt;
                p.mesh.rotation.x += p.spin.x * dt;
                p.mesh.rotation.y += p.spin.y * dt;
                p.mesh.rotation.z += p.spin.z * dt;
                if (p.mesh.position.y < 0.05) {
                    p.mesh.position.y = 0.05;
                    p.vel.y *= -0.18;
                    p.vel.x *= 0.7;
                    p.vel.z *= 0.7;
                    p.life -= dt * 1.5;
                }
                const fade = Math.max(0, Math.min(1, p.life / 1.1));
                p.mesh.material.opacity = 0.95 * fade;
                if (p.life <= 0) {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                    victoryConfetti.splice(i, 1);
                }
            }
        }

        function updateSpectators(dt) {
            updateSpectatorHitFx(dt);
            updateVictoryConfetti(dt);
            if (Math.random() < dt * 0.08) startRandomWalker();

            for (let i = 0; i < spectators.length; i += 1) {
                const npc = spectators[i];
                if (npc.hitCooldown > 0) npc.hitCooldown -= dt;

                if (npc.mode === 'seated') {
                    if (!updateCheerPose(npc, dt)) {
                        npc.head.rotation.y = Math.sin(performance.now() * 0.001 + i) * 0.12;
                    }
                    continue;
                }

                if (npc.mode === 'walking' && walkPath) {
                    npc.walkAngle += npc.walkDir * npc.walkSpeed * dt / Math.max(walkPath.rx, walkPath.rz);
                    npc.walkPhase += dt * 7.5;
                    const p = ellipsePoint(walkPath.rx, walkPath.rz, npc.walkAngle);
                    npc.root.position.set(p.x, walkPath.y, p.z);
                    faceEllipseTangent(npc, walkPath.rx, walkPath.rz, npc.walkAngle, npc.walkDir);
                    constrainNpcToTribune(npc, true);
                    separateActiveNpcs(npc);
                    const cheering = updateCheerPose(npc, dt);
                    if (!cheering) {
                        const swing = Math.sin(npc.walkPhase) * 0.55;
                        npc.legL.rotation.x = swing;
                        npc.legR.rotation.x = -swing;
                        npc.legLKnee.rotation.x = 0;
                        npc.legRKnee.rotation.x = 0;
                        npc.armL.rotation.x = -swing * 0.7;
                        npc.armR.rotation.x = swing * 0.7;
                        npc.hips.rotation.set(0, 0, 0);
                        npc.hips.position.y = 0.55 * npc.scale;
                    } else {
                        const swing = Math.sin(npc.walkPhase) * 0.35;
                        npc.legL.rotation.x = swing;
                        npc.legR.rotation.x = -swing;
                    }
                    if (npc.walkTimer > 0) {
                        npc.walkTimer -= dt;
                        if (npc.walkTimer <= 0 && npc.seat && Math.random() < 0.55) {
                            npc.returnTarget = npc.seat;
                            npc.mode = 'returning';
                        } else if (npc.walkTimer <= 0 && !npc.seat && Math.random() < 0.4) {
                            npc.walkTimer = 5 + Math.random() * 8;
                        }
                    }
                    continue;
                }

                if (npc.mode === 'returning') {
                    updateReturningNpc(npc, dt);
                    continue;
                }

                if (npc.mode === 'getting_up') {
                    updateGettingUp(npc, dt);
                    continue;
                }

                if (npc.mode === 'angry') {
                    updateAngryNpc(npc, dt);
                    continue;
                }

                if (npc.mode === 'ragdoll') {
                    npc.vel.y -= 11.5 * dt;
                    npc.root.position.x += npc.vel.x * dt;
                    npc.root.position.y += npc.vel.y * dt;
                    npc.root.position.z += npc.vel.z * dt;
                    npc.root.rotation.x += npc.spin.x * dt;
                    npc.root.rotation.y += npc.spin.y * dt * 0.55;
                    npc.root.rotation.z += npc.spin.z * dt;
                    npc.spin.multiplyScalar(0.985);

                    for (let j = 0; j < npc.joints.length; j += 1) {
                        const joint = npc.joints[j];
                        const av = joint.userData.av;
                        if (!av) continue;
                        joint.rotation.x += av.x * dt;
                        joint.rotation.y += av.y * dt * 0.45;
                        joint.rotation.z += av.z * dt;
                        av.x += (-Math.sin(joint.rotation.x) * 5.5 - av.x * 0.08) * dt;
                        av.z += (-Math.sin(joint.rotation.z) * 4.2 - av.z * 0.08) * dt;
                        av.y *= 0.99;
                        av.multiplyScalar(0.991);
                        joint.rotation.x = Math.max(-3.1, Math.min(3.1, joint.rotation.x));
                        joint.rotation.z = Math.max(-2.6, Math.min(2.6, joint.rotation.z));
                    }

                    resolveRagdollTribune(npc, dt);

                    npc.recoverT -= dt;
                    const settled = npc.grounded && npc.vel.length() < 0.45 && npc.spin.length() < 1.0;
                    if (npc.recoverT <= 0 && settled) {
                        getUpAfterFall(npc);
                    }
                }
            }
        }

        function collideSpectators(ball, vel) {
            const r = ballRadius;
            const p = ball.position;
            for (let i = 0; i < spectators.length; i += 1) {
                const npc = spectators[i];
                if (npc.mode === 'ragdoll' && npc.hitCooldown > 0) continue;
                const standing = npc.mode === 'walking' || npc.mode === 'returning' || npc.mode === 'angry';
                const bodyY = npc.root.position.y + npc.height * (standing ? 0.55 : 0.4);
                const hitR = npc.radius * (standing ? 1.15 : 1) + r;
                const dx = p.x - npc.root.position.x;
                const dy = p.y - bodyY;
                const dz = p.z - npc.root.position.z;
                const distSq = dx * dx + dy * dy * 0.5 + dz * dz;
                if (distSq > hitR * hitR) continue;

                const dist = Math.sqrt(Math.max(1e-6, distSq));
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;
                const push = hitR - dist;
                p.x += nx * push * 0.65;
                p.y += ny * push * 0.35;
                p.z += nz * push * 0.65;

                const speed = Math.hypot(vel.x, vel.y, vel.z);
                const vn = vel.x * nx + vel.y * ny + vel.z * nz;
                if (vn < 0) {
                    vel.x -= 1.35 * vn * nx;
                    vel.y -= 1.15 * vn * ny;
                    vel.z -= 1.35 * vn * nz;
                }
                vel.x *= 0.92;
                vel.z *= 0.92;

                if (speed > 0.85) {
                    knockSpectator(npc, new THREE.Vector3(
                        vel.x * 0.55 + nx * 1.4,
                        Math.max(1.1, Math.abs(vel.y) * 0.4 + 1.5),
                        vel.z * 0.55 + nz * 1.4
                    ), p);
                }
            }
        }

        woodMap.repeat.set(3, 4);
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(COURT_W, COURT_L),
            new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.82, metalness: 0.04 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0.01, COURT_Z0);
        floor.receiveShadow = true;
        scene.add(floor);

        const key = new THREE.Mesh(
            new THREE.PlaneGeometry(2.35, 2.9),
            new THREE.MeshStandardMaterial({ color: 0x6ea8e8, roughness: 0.7, metalness: 0.02 })
        );
        key.rotation.x = -Math.PI / 2;
        key.position.set(0, 0.02, HOOP_Z + 1.55);
        scene.add(key);

        const ft = new THREE.Mesh(
            new THREE.CircleGeometry(1.25, 40, 0, Math.PI),
            new THREE.MeshStandardMaterial({ color: 0x6ea8e8, roughness: 0.7, metalness: 0.02 })
        );
        ft.rotation.x = -Math.PI / 2;
        ft.rotation.z = Math.PI;
        ft.position.set(0, 0.025, HOOP_Z + 2.95);
        scene.add(ft);

        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        function addCourtLine(w, l, x, z) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
            m.rotation.x = -Math.PI / 2;
            m.position.set(x, 0.03, z);
            scene.add(m);
        }
        addCourtLine(2.45, 0.06, 0, HOOP_Z + 2.95);
        addCourtLine(0.06, 2.95, -1.2, HOOP_Z + 1.55);
        addCourtLine(0.06, 2.95, 1.2, HOOP_Z + 1.55);
        addCourtLine(COURT_W - 0.2, 0.05, 0, HOOP_Z + 0.08);

        const arcPts = [];
        for (let i = 0; i <= 28; i += 1) {
            const t = -Math.PI * 0.55 + (i / 28) * Math.PI * 1.1;
            arcPts.push(new THREE.Vector3(Math.sin(t) * 2.85, 0.035, HOOP_Z + 0.35 + Math.cos(t) * 2.85));
        }
        scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(arcPts),
            new THREE.LineBasicMaterial({ color: 0xffffff })
        ));

        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.12, 3.05, 16),
            new THREE.MeshStandardMaterial({ color: 0x3a424c, metalness: 0.45, roughness: 0.4 })
        );
        pole.position.set(0, 1.52, HOOP_Z - 0.72);
        pole.castShadow = true;
        scene.add(pole);

        const arm = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.14, 0.85),
            new THREE.MeshStandardMaterial({ color: 0x3a424c, metalness: 0.4, roughness: 0.4 })
        );
        arm.position.set(0, 2.55, HOOP_Z - 0.35);
        scene.add(arm);

        const backboard = new THREE.Mesh(
            new THREE.BoxGeometry(1.55, 1.05, 0.05),
            new THREE.MeshStandardMaterial({
                color: 0xeaf4ff,
                transparent: true,
                opacity: 0.72,
                roughness: 0.2,
                metalness: 0.05
            })
        );
        backboard.position.set(0, 2.55, HOOP_Z - 0.05);
        backboard.castShadow = true;
        scene.add(backboard);

        const boardFrame = new THREE.Mesh(
            new THREE.BoxGeometry(1.62, 1.12, 0.03),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
        );
        boardFrame.position.set(0, 2.55, HOOP_Z - 0.08);
        scene.add(boardFrame);

        const square = new THREE.Mesh(
            new THREE.PlaneGeometry(0.48, 0.36),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        square.position.set(0, 2.28, HOOP_Z - 0.02);
        scene.add(square);

        const rimY = 2.15;
        const rimZ = HOOP_Z + 0.28;
        const rimR = 0.42;
        const rimTube = 0.045;
        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(rimR, rimTube, 12, 48),
            new THREE.MeshBasicMaterial({ color: 0xff2200 })
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, rimY, rimZ);
        scene.add(rim);

        // Soft net strands (deform when the ball hits / goes through).
        const netStrands = [];
        const netMat = new THREE.LineBasicMaterial({ color: 0xffffff });
        const netBlue = new THREE.LineBasicMaterial({ color: 0x4d7dff });
        const NET_DEPTH = 0.68;
        for (let i = 0; i < 16; i += 1) {
            const a = (i / 16) * Math.PI * 2;
            const top = new THREE.Vector3(Math.cos(a) * rimR, rimY, rimZ + Math.sin(a) * rimR * 0.55);
            const mid = new THREE.Vector3(Math.cos(a) * rimR * 0.72, rimY - NET_DEPTH * 0.45, rimZ + Math.sin(a) * rimR * 0.28);
            const bot = new THREE.Vector3(Math.cos(a) * rimR * 0.38, rimY - NET_DEPTH, rimZ + Math.sin(a) * rimR * 0.12);
            const geo = new THREE.BufferGeometry().setFromPoints([top.clone(), mid.clone(), bot.clone()]);
            const line = new THREE.Line(geo, i % 2 ? netBlue : netMat);
            scene.add(line);
            netStrands.push({
                line,
                geo,
                top,
                midRest: mid.clone(),
                botRest: bot.clone(),
                mid: mid.clone(),
                bot: bot.clone(),
                phase: a
            });
        }
        let netEnergy = 0;
        let netOpen = 0;

        function updateNet(dt, ballPos, scoredNow) {
            if (scoredNow) {
                netEnergy = Math.max(netEnergy, 1.35);
                netOpen = Math.min(1, netOpen + dt * 4);
            } else if (ballPos) {
                const dx = ballPos.x;
                const dy = ballPos.y - (rimY - 0.25);
                const dz = ballPos.z - rimZ;
                const near = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (near < 0.85 && ballPos.y < rimY + 0.15) {
                    netEnergy = Math.min(1.8, netEnergy + (0.85 - near) * 6 * dt);
                    if (ballPos.y < rimY && Math.sqrt(dx * dx + dz * dz) < rimR * 0.95) {
                        netOpen = Math.min(1, netOpen + dt * 3.5);
                    }
                }
            }
            netEnergy = Math.max(0, netEnergy - dt * 1.15);
            netOpen = Math.max(0, netOpen - dt * 0.85);
            const tNow = performance.now() * 0.001;

            netStrands.forEach((s) => {
                const wave = Math.sin(tNow * 18 + s.phase * 2) * netEnergy * 0.09;
                const openPush = netOpen * 0.16;
                const outward = new THREE.Vector3(s.top.x, 0, s.top.z - rimZ).normalize();
                if (!isFinite(outward.x)) outward.set(1, 0, 0);

                s.mid.copy(s.midRest);
                s.bot.copy(s.botRest);
                s.mid.x += outward.x * (wave + openPush * 0.7);
                s.mid.z += outward.z * (wave + openPush * 0.7);
                s.mid.y -= netOpen * 0.08 + netEnergy * 0.04;
                s.bot.x += outward.x * (wave * 0.7 + openPush);
                s.bot.z += outward.z * (wave * 0.7 + openPush);
                s.bot.y -= netOpen * 0.12;

                if (ballPos && ballPos.y < rimY && ballPos.y > rimY - NET_DEPTH - 0.1) {
                    const pull = Math.max(0, 0.55 - ballPos.distanceTo(s.mid));
                    if (pull > 0) {
                        s.mid.lerp(ballPos, pull * 0.55);
                        s.bot.x += (ballPos.x - s.bot.x) * pull * 0.25;
                        s.bot.z += (ballPos.z - s.bot.z) * pull * 0.25;
                        netEnergy = Math.max(netEnergy, pull * 1.2);
                    }
                }

                s.geo.setFromPoints([s.top, s.mid, s.bot]);
            });
        }

        function collideHoopHardware(ball, vel) {
            const boardZ = HOOP_Z - 0.02;
            if (
                ball.position.z - ballRadius < boardZ &&
                ball.position.z > boardZ - 0.28 &&
                Math.abs(ball.position.x) < 0.78 &&
                ball.position.y > 2.0 &&
                ball.position.y < 3.1 &&
                vel.z < 0
            ) {
                ball.position.z = boardZ + ballRadius + 0.01;
                vel.z *= -0.55;
                vel.x *= 0.85;
                vel.y *= 0.9;
                netEnergy = Math.max(netEnergy, 0.35);
            }

            const dx = ball.position.x;
            const dz = ball.position.z - rimZ;
            const radial = Math.sqrt(dx * dx + dz * dz) || 0.0001;
            const tubeDist = Math.sqrt(
                ((radial - rimR) * (radial - rimR)) +
                ((ball.position.y - rimY) * (ball.position.y - rimY))
            );
            const hitR = rimTube + ballRadius;
            if (tubeDist < hitR && !ball.userData.crossedRim) {
                const nx = (radial - rimR) / (tubeDist || 1);
                const ny = (ball.position.y - rimY) / (tubeDist || 1);
                const nzRadial = nx;
                const rx = (dx / radial) * nzRadial;
                const rz = (dz / radial) * nzRadial;
                const push = (hitR - tubeDist) + 0.002;
                ball.position.x += rx * push;
                ball.position.z += rz * push;
                ball.position.y += ny * push;

                const nLen = Math.sqrt(rx * rx + ny * ny + rz * rz) || 1;
                const nxn = rx / nLen;
                const nyn = ny / nLen;
                const nzn = rz / nLen;
                const dot = vel.x * nxn + vel.y * nyn + vel.z * nzn;
                if (dot < 0) {
                    vel.x -= 1.55 * dot * nxn;
                    vel.y -= 1.55 * dot * nyn;
                    vel.z -= 1.55 * dot * nzn;
                    vel.x *= 0.92;
                    vel.y *= 0.88;
                    vel.z *= 0.92;
                }
                netEnergy = Math.max(netEnergy, 0.85);
            }
        }

        function softNetCapture(ball, vel, dt) {
            if (scored || ball.userData.spent) return;
            const dx = ball.position.x;
            const dz = ball.position.z - rimZ;
            const horiz = Math.sqrt(dx * dx + dz * dz);
            const inNet = horiz < rimR * 0.95 && ball.position.y < rimY && ball.position.y > rimY - NET_DEPTH;
            if (!inNet) return;

            vel.x *= Math.max(0.82, 1 - dt * 2.2);
            vel.z *= Math.max(0.82, 1 - dt * 2.2);
            vel.y *= Math.max(0.88, 1 - dt * 1.1);
            ball.position.x += (0 - ball.position.x) * dt * 2.4;
            ball.position.z += (rimZ - ball.position.z) * dt * 2.4;
            netEnergy = Math.max(netEnergy, 1.0);
            netOpen = Math.min(1, netOpen + dt * 2.5);
        }

        function makeBall() {
            const g = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.SphereGeometry(0.18, 28, 20),
                new THREE.MeshStandardMaterial({
                    color: 0xff7a18,
                    roughness: 0.45,
                    metalness: 0.04,
                    emissive: 0x4a1800,
                    emissiveIntensity: 0.35
                })
            );
            body.castShadow = true;
            g.add(body);
            const seamMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
            const seam = new THREE.TorusGeometry(0.181, 0.008, 8, 40);
            const a = new THREE.Mesh(seam, seamMat);
            const b = new THREE.Mesh(seam, seamMat);
            b.rotation.y = Math.PI / 2;
            const c = new THREE.Mesh(seam, seamMat);
            c.rotation.x = Math.PI / 2;
            g.add(a, b, c);
            return g;
        }

        const ballRadius = 0.18;
        const rackZ = BALL_Z;
        const rack = [];
        const MAX_SPENT_BALLS = 8;
        let rackSerial = 0;

        function spawnRackBall() {
            const ball = makeBall();
            ball.position.set(0, ballRadius, rackZ);
            ball.userData.home = new THREE.Vector3(0, ballRadius, rackZ);
            ball.userData.vel = new THREE.Vector3();
            ball.userData.inFlight = false;
            ball.userData.simulating = false;
            ball.userData.spent = false;
            ball.userData.missHandled = false;
            ball.userData.crossedRim = false;
            ball.userData.wentAboveRim = false;
            ball.userData.prevY = ballRadius;
            ball.userData.bounceCount = 0;
            ball.userData.escapedArena = false;
            ball.userData.rackIndex = rackSerial;
            rackSerial += 1;
            scene.add(ball);
            rack.push(ball);
            return ball;
        }

        function pruneSpentBalls() {
            const spent = rack.filter((b) => b.userData.spent);
            while (spent.length > MAX_SPENT_BALLS) {
                const old = spent.shift();
                const idx = rack.indexOf(old);
                if (idx >= 0) rack.splice(idx, 1);
                scene.remove(old);
            }
        }

        const rackMarker = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 0.26, 24),
            new THREE.MeshBasicMaterial({
                color: 0xff6a00,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            })
        );
        rackMarker.rotation.x = -Math.PI / 2;
        rackMarker.position.set(0, 0.02, rackZ);
        scene.add(rackMarker);

        let active = spawnRackBall();
        let dragging = false;
        let shotLive = false;
        let scored = false;
        let settleTimer = 0;
        const dragStart = new THREE.Vector2();
        const dragNow = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        const camLook = lookHome.clone();
        let animId = 0;
        let lastTs = 0;
        const SHOT_G = 7.6;
        const FLOOR_RESTITUTION = 0.74;
        const FLOOR_FRICTION = 0.9;

        const aimGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const aim = new THREE.Line(aimGeo, new THREE.LineBasicMaterial({
            color: 0xfff3c4, transparent: true, opacity: 0.85
        }));
        aim.visible = false;
        scene.add(aim);

        const trailPoints = [];
        const trailGeo = new THREE.BufferGeometry();
        const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
            color: 0xffb347, transparent: true, opacity: 0.75
        }));
        scene.add(trail);

        function playableBalls() {
            return rack.filter((b) => !b.userData.spent && !b.userData.simulating);
        }

        function showFlash(text, tone) {
            if (!flash) return;
            flash.hidden = false;
            flash.textContent = text;
            flash.dataset.tone = tone || 'ok';
            const status = document.getElementById('captcha-game-status');
            if (status && tone === 'miss') {
                status.textContent = 'Meleset — bola baru siap sebentar.';
                status.dataset.state = 'play';
            }
        }

        function hideFlashSoon(ms) {
            window.setTimeout(() => {
                if (!scored && flash) flash.hidden = true;
            }, ms);
        }

        function setPointer(event) {
            const rect = renderer.domElement.getBoundingClientRect();
            const src = (event.touches && event.touches[0]) || event;
            pointer.x = ((src.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
            pointer.y = -((src.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
            dragNow.set(src.clientX, src.clientY);
        }

        function pickBall(event) {
            setPointer(event);
            const live = playableBalls();
            if (!live.length) return null;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(live.map((b) => b.children[0]), false);
            if (hits.length) return hits[0].object.parent;
            if (raycaster.ray.intersectPlane(floorPlane, hit) && hit.z > BALL_Z - 1.1) {
                let best = null;
                let bestD = Infinity;
                live.forEach((b) => {
                    const d = Math.hypot(b.position.x - hit.x, b.position.z - hit.z);
                    if (d < bestD) {
                        bestD = d;
                        best = b;
                    }
                });
                return bestD < 0.9 ? best : null;
            }
            if (pointer.y < -0.15) {
                const nx = pointer.x;
                let best = live[0];
                let bestD = Infinity;
                live.forEach((b) => {
                    const d = Math.abs((b.position.x / 1.1) - nx);
                    if (d < bestD) {
                        bestD = d;
                        best = b;
                    }
                });
                return best;
            }
            return null;
        }

        function queueNextBall() {
            if (settleTimer) window.clearTimeout(settleTimer);
            settleTimer = window.setTimeout(() => {
                settleTimer = 0;
                if (scored) return;
                if (playableBalls().length) return;
                active = spawnRackBall();
                pruneSpentBalls();
                trailPoints.length = 0;
                trailGeo.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
                powerPhase = 0;
                autoPower = 0;
                lockedPower = 0;
                if (typeof setPowerMeter === 'function') setPowerMeter(0);
                const status = document.getElementById('captcha-game-status');
                if (status) {
                    status.textContent = 'Tahan bola — lepas di GOOD atau PERFECT agar sesuai jalur.';
                }
            }, 2000);
        }

        function resetRack(keepScore) {
            if (settleTimer) {
                window.clearTimeout(settleTimer);
                settleTimer = 0;
            }
            rack.slice().forEach((b) => scene.remove(b));
            rack.length = 0;
            active = spawnRackBall();
            dragging = false;
            shotLive = false;
            netEnergy = 0;
            netOpen = 0;
            aim.visible = false;
            trailPoints.length = 0;
            trailGeo.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
            camLook.copy(lookHome);
            camera.position.copy(camHome);
            camera.lookAt(camLook);
            powerPhase = 0;
            autoPower = 0;
            lockedPower = 0;
            if (typeof setPowerMeter === 'function') setPowerMeter(0);
            if (!keepScore) {
                scored = false;
                scoreValue = 0;
                timeLeft = 45;
                timerArmed = false;
                paintBoard();
                setCaptchaPassed(false);
                host.classList.remove('is-scored');
                clearVictoryConfetti();
                if (flash) {
                    flash.hidden = true;
                    flash.textContent = 'SKOR!';
                    flash.dataset.tone = 'ok';
                }
            }
        }

        function checkScore(ball) {
            if (scored || ball.userData.spent) return;
            const vel = ball.userData.vel;
            const dx = ball.position.x;
            const dz = ball.position.z - rimZ;
            const y = ball.position.y;
            const horiz = Math.sqrt(dx * dx + dz * dz);
            const inRimCylinder = horiz < rimR * 0.92;
            const falling = vel.y < -0.15;

            if (y > rimY + 0.22) {
                ball.userData.wentAboveRim = true;
            }

            if (
                ball.userData.wentAboveRim &&
                falling &&
                !ball.userData.crossedRim &&
                ball.userData.prevY >= rimY &&
                y < rimY &&
                inRimCylinder
            ) {
                ball.userData.crossedRim = true;
            }

            if (
                ball.userData.crossedRim &&
                falling &&
                inRimCylinder &&
                y < rimY - 0.1 &&
                y > rimY - 0.7
            ) {
                scored = true;
                shotLive = false;
                ball.userData.simulating = false;
                ball.userData.inFlight = false;
                vel.set(0, 0, 0);
                ball.position.set(0, rimY - 0.42, rimZ);
                scoreValue = 1;
                paintBoard();
                host.classList.add('is-scored');
                showFlash('SKOR!', 'ok');
                setCaptchaPassed(true);
                humanTouched = true;
                netEnergy = 1.6;
                netOpen = 1;
                triggerCrowdCheer();
                spawnVictoryConfetti();
            }

            ball.userData.prevY = y;
        }

        function collideArenaBounds(ball, vel) {
            if (ball.userData.escapedArena) return;

            const innerMinX = boundMinX + ballRadius;
            const innerMaxX = boundMaxX - ballRadius;
            const innerMinZ = boundMinZ + ballRadius;
            const innerMaxZ = boundMaxZ - ballRadius;
            const outerMinX = boundMinX - WALL_T - ballRadius;
            const outerMaxX = boundMaxX + WALL_T + ballRadius;
            const outerMinZ = boundMinZ - WALL_T - ballRadius;
            const outerMaxZ = boundMaxZ + WALL_T + ballRadius;

            // Already past the visible wall (flew over / outside) — no invisible outer cage.
            if (
                ball.position.x < outerMinX ||
                ball.position.x > outerMaxX ||
                ball.position.z < outerMinZ ||
                ball.position.z > outerMaxZ
            ) {
                ball.userData.escapedArena = true;
                return;
            }

            // Above the visible wall top — can clear the wall; don't invent a taller barrier.
            if (ball.position.y > WALL_H + ballRadius) {
                if (
                    ball.position.x < boundMinX ||
                    ball.position.x > boundMaxX ||
                    ball.position.z < boundMinZ ||
                    ball.position.z > boundMaxZ
                ) {
                    ball.userData.escapedArena = true;
                }
                return;
            }

            // Bounce only from inside against the visible wall faces.
            if (ball.position.x <= innerMinX && ball.position.x >= boundMinX - WALL_T && vel.x < 0) {
                ball.position.x = innerMinX;
                vel.x = -vel.x * WALL_RESTITUTION;
            } else if (ball.position.x >= innerMaxX && ball.position.x <= boundMaxX + WALL_T && vel.x > 0) {
                ball.position.x = innerMaxX;
                vel.x = -vel.x * WALL_RESTITUTION;
            }
            if (ball.position.z <= innerMinZ && ball.position.z >= boundMinZ - WALL_T && vel.z < 0) {
                ball.position.z = innerMinZ;
                vel.z = -vel.z * WALL_RESTITUTION;
            } else if (ball.position.z >= innerMaxZ && ball.position.z <= boundMaxZ + WALL_T && vel.z > 0) {
                ball.position.z = innerMaxZ;
                vel.z = -vel.z * WALL_RESTITUTION;
            }
        }

        function collideBleachers(ball, vel) {
            const r = ballRadius;
            const p = ball.position;
            for (let i = 0; i < bleacherColliders.length; i += 1) {
                const box = bleacherColliders[i];
                const cx = Math.max(box.minX, Math.min(p.x, box.maxX));
                const cy = Math.max(box.minY, Math.min(p.y, box.maxY));
                const cz = Math.max(box.minZ, Math.min(p.z, box.maxZ));
                let dx = p.x - cx;
                let dy = p.y - cy;
                let dz = p.z - cz;
                let distSq = dx * dx + dy * dy + dz * dz;

                if (distSq > r * r) continue;

                let nx;
                let ny;
                let nz;
                let push;
                if (distSq < 1e-8) {
                    const penX = Math.min(p.x - box.minX, box.maxX - p.x);
                    const penY = Math.min(p.y - box.minY, box.maxY - p.y);
                    const penZ = Math.min(p.z - box.minZ, box.maxZ - p.z);
                    if (penX <= penY && penX <= penZ) {
                        nx = p.x < (box.minX + box.maxX) * 0.5 ? -1 : 1;
                        ny = 0;
                        nz = 0;
                        push = penX + r;
                    } else if (penY <= penX && penY <= penZ) {
                        nx = 0;
                        ny = p.y < (box.minY + box.maxY) * 0.5 ? -1 : 1;
                        nz = 0;
                        push = penY + r;
                    } else {
                        nx = 0;
                        ny = 0;
                        nz = p.z < (box.minZ + box.maxZ) * 0.5 ? -1 : 1;
                        push = penZ + r;
                    }
                } else {
                    const dist = Math.sqrt(distSq);
                    nx = dx / dist;
                    ny = dy / dist;
                    nz = dz / dist;
                    push = r - dist;
                }

                p.x += nx * push;
                p.y += ny * push;
                p.z += nz * push;

                const vn = vel.x * nx + vel.y * ny + vel.z * nz;
                if (vn < 0) {
                    const bounce = 1 + box.rest;
                    vel.x -= bounce * vn * nx;
                    vel.y -= bounce * vn * ny;
                    vel.z -= bounce * vn * nz;
                    vel.x *= 0.94;
                    vel.y *= 0.9;
                    vel.z *= 0.94;
                }
            }
        }

        function bounceFloor(ball, vel) {
            ball.position.y = ballRadius;
            if (vel.y >= 0) return;
            ball.userData.bounceCount = (ball.userData.bounceCount || 0) + 1;
            vel.y = -vel.y * FLOOR_RESTITUTION;
            vel.x *= FLOOR_FRICTION;
            vel.z *= FLOOR_FRICTION;
            // Keep early bounces visible — don't freeze on first miss contact.
            if (ball.userData.bounceCount <= 4) {
                const minUp = 1.35 - ball.userData.bounceCount * 0.22;
                if (vel.y < minUp) vel.y = minUp;
                if (Math.hypot(vel.x, vel.z) < 0.35) {
                    const yaw = Math.atan2(vel.x || 0.01, vel.z || -0.01);
                    vel.x += Math.sin(yaw) * 0.25;
                    vel.z += Math.cos(yaw) * 0.25;
                }
                return;
            }
            if (Math.abs(vel.y) < 0.3 && Math.hypot(vel.x, vel.z) < 0.18) {
                vel.set(0, 0, 0);
                ball.userData.simulating = false;
                ball.userData.inFlight = false;
            }
        }

        function handleMiss(ball) {
            if (ball.userData.missHandled || scored) return;
            ball.userData.missHandled = true;
            ball.userData.spent = true;
            ball.userData.simulating = true;
            shotLive = false;
            showFlash('MISS', 'miss');
            hideFlashSoon(700);
            queueNextBall();
        }

        function animate(ts) {
            animId = window.requestAnimationFrame(animate);
            const dt = Math.min(0.033, ((ts - lastTs) || 16) / 1000);
            lastTs = ts;

            if (!scored && timerArmed && timeLeft > 0) {
                timeLeft -= dt;
                if (timeEl && Math.floor(timeLeft) !== Number(timeEl.textContent)) paintBoard();
            }

            updateSpectators(dt);

            let tracked = null;
            rack.forEach((ball) => {
                if (!ball.userData.simulating) return;
                const vel = ball.userData.vel;
                vel.y += -SHOT_G * dt;
                ball.position.x += vel.x * dt;
                ball.position.y += vel.y * dt;
                ball.position.z += vel.z * dt;
                ball.rotation.x += Math.abs(vel.z) * dt * 1.15;
                ball.rotation.z -= vel.x * dt * 0.95;

                collideHoopHardware(ball, vel);
                softNetCapture(ball, vel, dt);
                collideArenaBounds(ball, vel);
                collideBleachers(ball, vel);
                collideSpectators(ball, vel);
                if (!ball.userData.spent) checkScore(ball);

                if (ball.position.y <= ballRadius) {
                    const firstFloor = !ball.userData.missHandled && !scored;
                    bounceFloor(ball, vel);
                    if (firstFloor && !scored) handleMiss(ball);
                }

                if (!ball.userData.spent || ball === active) tracked = ball;
                updateNet(dt, ball.position, false);
            });

            if (tracked && tracked.userData.simulating && !tracked.userData.spent) {
                trailPoints.push(tracked.position.clone());
                if (trailPoints.length > 64) trailPoints.shift();
                if (trailPoints.length > 1) trailGeo.setFromPoints(trailPoints);
                camLook.lerp(new THREE.Vector3(
                    lookHome.x + tracked.position.x * 0.12,
                    Math.max(lookHome.y, tracked.position.y * 0.22 + 0.9),
                    lookHome.z + (tracked.position.z - lookHome.z) * 0.18
                ), 0.035);
                camera.position.lerp(camHome, 0.12);
                camera.lookAt(camLook);
            } else if (!dragging) {
                camLook.lerp(lookHome, 0.06);
                camera.position.lerp(camHome, 0.08);
                camera.lookAt(camLook);
                updateNet(dt, scored && active ? active.position : null, scored);
            } else {
                updateAutoPower(dt);
                updateAimPreview();
                updateNet(dt, null, scored);
            }

            renderer.render(scene, camera);
        }

        function onPointerDown(event) {
            if (scored || shotLive || dragging) return;
            event.preventDefault();
            const ball = pickBall(event);
            if (!ball || ball.userData.simulating) return;
            humanTouched = true;
            timerArmed = true;
            active = ball;
            dragging = true;
            powerPhase = 0;
            autoPower = 0;
            setPowerMeter(0);
            trailPoints.length = 0;
            setPointer(event);
            dragStart.copy(dragNow);
            if (typeof renderer.domElement.setPointerCapture === 'function') {
                renderer.domElement.setPointerCapture(event.pointerId);
            }
        }

        const POWER_CYCLE_SEC = 1.15;
        // 6 segmen kiri→kanan: LOW → MEDIUM → GOOD → PERFECT → STRONG → FULL
        const POWER_BANDS = [
            { id: 'low', label: 'LOW', mult: 0.36 },
            { id: 'medium', label: 'MEDIUM', mult: 0.58 },
            { id: 'good', label: 'GOOD', mult: 0.94 },
            { id: 'perfect', label: 'PERFECT', mult: 1.0 },
            { id: 'strong', label: 'STRONG', mult: 1.32 },
            { id: 'full', label: 'FULL', mult: 1.78 }
        ];
        let powerPhase = 0;
        let autoPower = 0;
        let lockedPower = 0;

        function powerBandIndex(ratio) {
            const t = Math.max(0, Math.min(0.9999, ratio));
            return Math.min(POWER_BANDS.length - 1, Math.floor(t * POWER_BANDS.length));
        }

        function powerBand(ratio) {
            return POWER_BANDS[powerBandIndex(ratio)];
        }

        function setPowerMeter(ratio) {
            const r = Math.max(0, Math.min(1, ratio));
            const band = powerBand(r);
            if (powerNeedleEl) {
                // Jarum default mengarah kiri; putar CW 0→180° (LOW→FULL).
                const deg = r * 180;
                powerNeedleEl.setAttribute('transform', `rotate(${deg} 100 100)`);
            }
            if (powerValueEl) {
                powerValueEl.textContent = band.label;
                powerValueEl.dataset.zone = band.id;
            }
        }

        function updateAutoPower(dt) {
            powerPhase += dt / POWER_CYCLE_SEC;
            const tri = powerPhase % 2;
            autoPower = tri <= 1 ? tri : 2 - tri;
            setPowerMeter(autoPower);
        }

        setPowerMeter(0);

        // GOOD ≈ mendekati jalur; PERFECT = sangat sesuai jalur (mult 1.0).
        function refinePathMultiplier(ratio) {
            const t = Math.max(0, Math.min(1, ratio)) * (POWER_BANDS.length - 1);
            const i = Math.floor(t);
            const f = t - i;
            const a = POWER_BANDS[i].mult;
            const b = POWER_BANDS[Math.min(POWER_BANDS.length - 1, i + 1)].mult;
            return a + (b - a) * f;
        }

        function computeAimDirection(pullX, pullY) {
            const back = Math.max(0, pullY);
            let dirX = -pullX;
            let dirZ = -Math.max(back, 40);
            const dirLen = Math.hypot(dirX, dirZ) || 1;
            dirX /= dirLen;
            dirZ /= dirLen;
            return { dirX, dirZ, back };
        }

        // Preview jalur seperti sebelum power bar: mengikuti tarikan bebas (tidak dibatasi bar).
        function computeAimArc(start, pullX, pullY) {
            const g = SHOT_G;
            const { dirX, dirZ, back } = computeAimDirection(pullX, pullY);
            const pullLen = Math.hypot(pullX, back);
            const power = pullLen / 140;

            const toRimX = -start.x;
            const toRimZ = rimZ - start.z;
            const toRimLen = Math.hypot(toRimX, toRimZ) || 1;
            const rimMix = 0.28;
            let fx = dirX * (1 - rimMix) + (toRimX / toRimLen) * rimMix;
            let fz = dirZ * (1 - rimMix) + (toRimZ / toRimLen) * rimMix;
            const fLen = Math.hypot(fx, fz) || 1;
            fx /= fLen;
            fz /= fLen;

            const apexLift = 1.05 + power * 2.15;
            const vy = Math.sqrt(Math.max(0.5, 2 * g * apexLift));
            const speed = 2.9 + power * 3.6;
            const flightT = (2 * vy) / g;

            return {
                vx: fx * speed,
                vy,
                vz: fz * speed,
                flightT,
                g
            };
        }

        // Lemparan aktual: baseline = jalur aim; dikalikan multiplier power bar.
        function computeShotArc(start, pullX, pullY, powerRatio) {
            const aim = computeAimArc(start, pullX, pullY);
            const mult = refinePathMultiplier(powerRatio);
            return {
                vx: aim.vx * mult,
                vy: aim.vy * mult,
                vz: aim.vz * mult,
                flightT: aim.flightT / Math.max(0.35, Math.sqrt(mult)),
                g: aim.g,
                powerRatio,
                throwPower: mult
            };
        }

        function sampleArcPoints(start, arc, steps) {
            const a = 0.5 * arc.g;
            const b = -arc.vy;
            const c = ballRadius - start.y;
            const disc = (b * b) - (4 * a * c);
            let tEnd = arc.flightT * 1.15;
            if (disc >= 0 && a > 0) {
                const root = Math.sqrt(disc);
                const t1 = (-b + root) / (2 * a);
                const t2 = (-b - root) / (2 * a);
                tEnd = Math.max(0.45, Math.max(t1, t2));
            }
            const pts = [];
            for (let i = 0; i <= steps; i += 1) {
                const t = (i / steps) * tEnd;
                pts.push(new THREE.Vector3(
                    start.x + arc.vx * t,
                    start.y + arc.vy * t - 0.5 * arc.g * t * t,
                    start.z + arc.vz * t
                ));
            }
            return pts;
        }

        function currentPull() {
            const pullY = dragNow.y - dragStart.y;
            const pullX = dragNow.x - dragStart.x;
            const back = Math.max(0, pullY);
            return { pullX, pullY, back };
        }

        function updateAimPreview() {
            if (!dragging || !active || scored) return;
            const { pullX, back } = currentPull();
            const arc = computeAimArc(active.position, pullX, back);
            aimGeo.setFromPoints(sampleArcPoints(active.position, arc, 40));
            if (aim.material) aim.material.color.setHex(0xfff3c4);
            aim.visible = true;
        }

        function onPointerMove(event) {
            if (!dragging || !active || scored) return;
            event.preventDefault();
            setPointer(event);
            const { pullX, back } = currentPull();
            active.position.x = active.userData.home.x + pullX * 0.0045;
            active.position.y = ballRadius;
            active.position.z = active.userData.home.z + back * 0.0055;
            updateAimPreview();
        }

        function onPointerUp(event) {
            if (!dragging || !active || scored) return;
            event.preventDefault();
            setPointer(event);
            const { pullX, back } = currentPull();
            lockedPower = autoPower;
            dragging = false;
            shotLive = true;
            active.userData.inFlight = true;
            active.userData.simulating = true;
            active.userData.spent = false;
            active.userData.missHandled = false;
            active.userData.crossedRim = false;
            active.userData.wentAboveRim = false;
            active.userData.prevY = active.position.y;
            active.userData.bounceCount = 0;
            active.userData.escapedArena = false;
            trailPoints.length = 0;

            const arc = computeShotArc(active.position, pullX, back, lockedPower);
            setPowerMeter(lockedPower);
            active.userData.vel.set(arc.vx, arc.vy, arc.vz);
            aim.visible = false;
        }

        function onResize() {
            const w = width();
            const h = height();
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
        }

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointercancel', () => {
            if (dragging && active && !active.userData.simulating) active.position.copy(active.userData.home);
            dragging = false;
            aim.visible = false;
            powerPhase = 0;
            autoPower = 0;
            setPowerMeter(0);
        });
        window.addEventListener('resize', onResize);
        window.setTimeout(onResize, 50);
        window.requestAnimationFrame(onResize);

        lastTs = performance.now();
        animId = window.requestAnimationFrame(animate);

        return {
            reset() {
                resetRack(false);
            },
            destroy() {
                window.cancelAnimationFrame(animId);
                window.removeEventListener('resize', onResize);
                renderer.dispose();
                mount.innerHTML = '';
            }
        };
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.threeSrc = src;
            script.onload = () => {
                if (window.THREE) resolve(window.THREE);
                else reject(new Error('THREE global missing after ' + src));
            };
            script.onerror = () => reject(new Error('Failed to load ' + src));
            document.head.appendChild(script);
        });
    }

    function loadThree() {
        if (window.THREE) {
            return Promise.resolve(window.THREE);
        }
        const sources = [
            'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js',
            'https://unpkg.com/three@0.160.1/build/three.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
        ];
        return sources.reduce(
            (chain, src) => chain.catch(() => loadScript(src)),
            Promise.reject(new Error('start'))
        );
    }

    function setupForm() {
        const form = document.getElementById('contact-form');
        const host = document.getElementById('contact-captcha');
        if (!form || !host) return;

        const status = document.getElementById('contact-status');
        const refreshBtn = document.getElementById('captcha-refresh');
        const fields = form.querySelectorAll('input, textarea, select');

        setCaptchaPassed(false);

        loadThree()
            .then((THREE) => {
                try {
                    game = createBasketGame3D(host, THREE);
                } catch (err) {
                    console.error('[contact-3d] init failed', err);
                    setStatus(status, 'Gagal menyiapkan arena 3D. Muat ulang halaman.', 'error');
                }
            })
            .catch((err) => {
                console.error('[contact-3d] load failed', err);
                setStatus(status, MSG_NO_WEBGL, 'error');
            });

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                setStatus(status, STATUS_IDLE, 'info');
                if (game) game.reset();
            });
        }

        fields.forEach((field) => {
            if (field.matches('[data-contact-trap]')) return;
            field.addEventListener('focus', () => {
                humanTouched = true;
            }, { once: true });
            field.addEventListener('input', () => {
                humanTouched = true;
            }, { once: true });
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            setStatus(status, STATUS_IDLE, 'info');

            const name = document.getElementById('contact-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const need = document.getElementById('contact-need').value.trim();
            const budget = document.getElementById('contact-budget').value;
            const timeline = document.getElementById('contact-timeline').value;

            if (!name || !email || !need || !budget || !timeline) {
                setStatus(status, MSG_INVALID, 'error');
                return;
            }

            if (!captchaPassed) {
                setStatus(status, MSG_CAPTCHA, 'error');
                return;
            }

            if (isBotSubmission(form)) {
                setStatus(status, MSG_BLOCKED, 'error');
                if (game) game.reset();
                return;
            }

            const subject = encodeURIComponent(`Pesan untuk Rogue Development — ${name}`);
            const body = encodeURIComponent(
                `Nama: ${name}\nEmail: ${email}\nBudget: ${budget}\nTimeline: ${timeline}\n\nKebutuhan:\n${need}`
            );

            let inbox = '';
            try {
                inbox = resolveInbox();
            } catch (_err) {
                setStatus(status, MSG_BLOCKED, 'error');
                return;
            }

            if (!inbox || inbox.indexOf('@') < 1) {
                setStatus(status, MSG_BLOCKED, 'error');
                return;
            }

            setStatus(status, MSG_READY, 'ok');
            window.location.href = `mailto:${inbox}?subject=${subject}&body=${body}`;
            inbox = '';
        });
    }

    function setupYear() {
        document.querySelectorAll('.dynamic-year').forEach((el) => {
            el.textContent = String(new Date().getFullYear());
        });
    }

    function setupNav() {
        const nav = document.querySelector('nav');
        const toggle = document.querySelector('.nav-toggle');
        if (!nav || !toggle) return;

        const setOpen = (open) => {
            nav.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
            toggle.textContent = open ? 'Tutup' : 'Menu';
        };

        toggle.addEventListener('click', () => {
            setOpen(!nav.classList.contains('is-open'));
        });

        nav.querySelectorAll('.nav-links a').forEach((link) => {
            link.addEventListener('click', () => setOpen(false));
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupYear();
        setupNav();
        setupForm();
    });
})();
