/// import * as Autodesk from "@types/forge-viewer";

import { initViewer, loadModel } from './viewer.js';

const preview = document.getElementById('preview');

initViewer(preview, ['Autodesk.DataVisualization']).then(async viewer => {
    const urn = window.location.hash ? window.location.hash.substr(1) : null;
    await setupModelSelection(viewer, urn);
    viewer.setGroundReflection(false)
    viewer.disableHighlight(true)

    // viewer.setGroundShadow(false)    
    preview.addEventListener('click', function (ev) {
        console.clear()
        let screenPoint = {x: ev.clientX,y: ev.clientY};
        // hit test
        var hitTest = viewer.impl.hitTest(screenPoint.x,screenPoint.y,true);
        // draw the temporary triangle face
        viewer.clearSelection()
        if(hitTest && hitTest.dbId===2928){
            devices.forEach((el)=>{
                const psource = new THREE.Vector3(hitTest.point.x,hitTest.point.y,-5)
                const ptarget = new THREE.Vector3(el.position.x,el.position.y,-5)
                const vray = new THREE.Vector3(ptarget.x - psource.x,ptarget.y - psource.y, 0)
                vray.normalize ();
                let max_dist = psource.distanceTo(ptarget)
                let ray = new THREE.Raycaster( psource, vray, 0, max_dist )
                let intersectResults = ray.intersectObjects ( wallMeshes, true )
                // let intersectResults = viewer.impl.rayIntersect(ray.ray, false,wallIds);
                // let nwalls = intersectResults.length;
                // el.sensorValue = 
                // max_dist * attenuation_per_m_in_air +
                // nWalls * this._attenuation_per_wall
                console.log(intersectResults)
            })
            
            // viewer.clearSelection()
            // console.clear()
            console.log(hitTest)
        }
    });
    
    viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, ()=>{
        
        // addHeatMap(viewer)
         setTimeout(()=>{
            addHeatMap(viewer)
        },2000)
    } );
   
});

async function setupModelSelection(viewer, selectedUrn) {
    const models = document.getElementById('models');
    models.innerHTML = '';
    const resp = await fetch('/api/models');
    if (resp.ok) {
        for (const model of await resp.json()) {
            const option = document.createElement('option');
            option.innerText = model.name;
            option.setAttribute('value', model.urn);
            if (model.urn === selectedUrn) {
                option.setAttribute('selected', 'true');
            }
            models.appendChild(option);
        }
    } else {
        alert('Could not list models. See the console for more details.');
        console.error(await resp.text());
    }
    models.onchange = async () => {
        window.location.hash = models.value;
        loadModel(viewer, models.value);
    }
    if (!viewer.model && models.value) {
        models.onchange();
    }
}

let devices = [];
function generateDevices(startpoints) {
    let id = 0;
    for (let i = 0; i < 11; i++) {
        startpoints.y = 25;
        for (let j = 0; j < 11; j++) {
            let x = {
                id: (id++), // An ID to identify this device
                position: { x: startpoints.x, y: startpoints.y, z: -5 }, // World coordinates of this device
                sensorTypes: ["temperature"], // The types/properties this device exposes
            }
            devices.push(x)
            startpoints.y-=5
        }
        startpoints.x+=5
    }
}
let startpoints = {x:-25,y:25};
generateDevices(startpoints);

function getComponentsByParentName (name, model) {
    const instanceTree = model.getData().instanceTree

    const rootId = instanceTree.getRootId()

    let parentId = 0

    instanceTree.enumNodeChildren(rootId,
      (childId) => {
        const nodeName = instanceTree.getNodeName(childId)

        if (nodeName.indexOf(name) > -1) {
          parentId = childId
        }
      })

    return parentId > 0
      ? getLeafNodes(model, parentId)
      : []
  }

function getLeafNodes (model, dbIds) {
    return new Promise((resolve, reject) => {
      try {
        const instanceTree =
          model.getData().instanceTree ||
          model.getFragmentMap()

        dbIds = dbIds || instanceTree.getRootId()

        const dbIdArray = Array.isArray(dbIds)
          ? dbIds
          : [dbIds]

        const leafIds = []

        const getLeafNodeIdsRec = (id) => {
          let childCount = 0

          instanceTree.enumNodeChildren(id, (childId) => {
            getLeafNodeIdsRec(childId)
            ++childCount
          })

          if (childCount === 0) {
            leafIds.push(id)
          }
        }

        dbIdArray.forEach((dbId) => {
          getLeafNodeIdsRec(dbId)
        })

        return resolve(leafIds)
      } catch (ex) {
        return reject(ex)
      }
    })
  }  

function buildComponentMesh (
    viewer, model, dbId, faceFilter, material) {
    const meshGeometry =
      buildComponentGeometry(
        viewer, model, dbId, faceFilter)

    meshGeometry.computeFaceNormals()
    meshGeometry.computeVertexNormals()

    // creates THREE.Mesh
    const mesh = new THREE.Mesh(
      meshGeometry, material)

    mesh.dbId = dbId

    return mesh
  }

function buildComponentGeometry (
    viewer, model, dbId, faceFilter) {
    // first we assume the component dbId is a leaf
    // component: ie has no child so contains
    // geometry. This util method will return all fragIds
    // associated with that specific dbId
    const fragIds = getLeafFragIds(model, dbId)

    let matrixWorld = null

    const meshGeometry = new THREE.Geometry()

    fragIds.forEach((fragId) => {
      // for each fragId, get the proxy in order to access
      // THREE geometry
      const renderProxy =
        viewer.impl.getRenderProxy(
          model, fragId)

      matrixWorld = matrixWorld || renderProxy.matrixWorld

      const geometry = renderProxy.geometry

      const attributes = geometry.attributes

      const positions = geometry.vb
        ? geometry.vb
        : attributes.position.array

      const indices = attributes.index.array || geometry.ib

      const stride = geometry.vb ? geometry.vbstride : 3

      const offsets = [{
        count: indices.length,
        index: 0,
        start: 0
      }]

      for (var oi = 0, ol = offsets.length; oi < ol; ++oi) {
        var start = offsets[oi].start
        var count = offsets[oi].count
        var index = offsets[oi].index

        for (var i = start, il = start + count; i < il; i += 3) {
          const a = index + indices[i]
          const b = index + indices[i + 1]
          const c = index + indices[i + 2]

          const vA = new THREE.Vector3()
          const vB = new THREE.Vector3()
          const vC = new THREE.Vector3()

          vA.fromArray(positions, a * stride)
          vB.fromArray(positions, b * stride)
          vC.fromArray(positions, c * stride)

          if (!faceFilter || faceFilter(vA, vB, vC)) {
            const faceIdx = meshGeometry.vertices.length

            meshGeometry.vertices.push(vA)
            meshGeometry.vertices.push(vB)
            meshGeometry.vertices.push(vC)

            const face = new THREE.Face3(
              faceIdx, faceIdx + 1, faceIdx + 2)

            meshGeometry.faces.push(face)
          }
        }
      }
    })

    meshGeometry.applyMatrix(matrixWorld)

    return meshGeometry
  }
function getLeafFragIds (model, leafId) {
    if (model.getData().instanceTree) {
      const it = model.getData().instanceTree

      const fragIds = []

      it.enumNodeFragments(
        leafId, (fragId) => {
          fragIds.push(fragId)
        })

      return fragIds
    } else {
      const fragments = model.getData().fragments

      const fragIds = fragments.dbId2fragId[leafId]

      return !Array.isArray(fragIds)
        ? [fragIds]
        : fragIds
    }
  }

let wallIds;
let wallMeshes;

async function addHeatMap(viewer) {

    const model = viewer.model
    wallIds = await getComponentsByParentName('Walls', model)
    console.log('wallIds:')
    console.log(wallIds)
    wallMeshes = wallIds.map((dbId) => {
        return buildComponentMesh(
          viewer, model, dbId)
      })
console.clear()
// console.log('wallMeshes:')
// console.log(wallMeshes)

    window.model = viewer.model;
    window.dataVizExtn = viewer.getExtension('Autodesk.DataVisualization');
    // Given a model loaded from Autodesk Platform Services
    const structureInfo = new Autodesk.DataVisualization.Core.ModelStructureInfo(model);

    // Generates `SurfaceShadingData` after assigning each device to a room.
    const shadingData = await structureInfo.generateSurfaceShadingData(devices);

    // Use the resulting shading data to generate heatmap from.
    await dataVizExtn.setupSurfaceShading(model, shadingData, {
        type: "PlanarHeatmap",
        placementPosition: 0.0,
        slicingEnabled: false,
    });

    // Register color stops for the heatmap. Along with the normalized sensor value
    // in the range of [0.0, 1.0], `renderSurfaceShading` will interpolate the final
    // heatmap color based on these specified colors.
    const sensorColors = [0xff0000, 0x0000ff, 0x00ff00];

    // Set heatmap colors for temperature
    const sensorType = "temperature";
    dataVizExtn.registerSurfaceShadingColors(sensorType, sensorColors);

    // Function that provides a [0,1] value for the planar heatmap
    function getSensorValue(surfaceShadingPoint, sensorType, pointData) {
        /**
         * The position of `surfaceShadingPoint` expressed in coordinate values
         * with respect to the top-left corner of the underlying texture. For
         * example, with a texture of dimensions 2048x1024 pixels, a point located
         * at the mid-point of the texture would be { x: 1024, y: 512 }. The
         * texture dimension is determined when the planar heatmap was set up.
         */
        const { x, y } = pointData;

        /**
         * The client implementation of `getSensorValue` callback can optionally
         * make use of the coordinate values to compute the normalized value of
         * this given `surfaceShadingPoint`.
         */
        // const sensorValue = computeSensorValue(x, y);
        const sensorValue = Math.random();
        return clamp(sensorValue, 0.0, 1.0);
    }
    // function getSensorValue() {
    //     return Math.random(); 
    // }
    let clamp = function (value, lower, upper) {
        if (value == undefined) {
            return lower;
        }

        if (value > upper) {
            return upper;
        } else if (value < lower) {
            return lower;
        } else {
            return value;
        }
    }
    // This value can also be a room instead of a floor
    // const floorName = "Floor [338116]";
    const floorName = "Varun's Room 103 [340619]";
    dataVizExtn.renderSurfaceShading(floorName, sensorType, getSensorValue);
    dataVizExtn.updateSurfaceShading(getSensorValue);
    // setTimeout(()=>{},3000)
}



