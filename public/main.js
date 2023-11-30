/// import * as Autodesk from "@types/forge-viewer";

import { initViewer, loadModel } from './viewer.js';

const preview = document.getElementById('preview');

initViewer(preview, ['Autodesk.DataVisualization']).then(async viewer => {
    const urn = window.location.hash ? window.location.hash.substr(1) : null;
    await setupModelSelection(viewer, urn);
    // preview.addEventListener('click', function (ev) {
    //     const rect = preview.getBoundingClientRect();
    //     const hit = viewer.hitTest(ev.clientX - rect.left, ev.clientY - rect.top);
    //     console.log(hit.point)
    // });
      // when mouse move
    //   preview.addEventListener('click', function (event) {

    //     // get current screen point
    //     var screenPoint = {
    //     x: event.clientX,
    //     y: event.clientY
    //     };
    //     // hit test
    //     var hitTest = viewer.impl.hitTest(screenPoint.x,screenPoint.y,true);
    //     // draw the temporary triangle face
    //     if(hitTest){
    //         console.clear()
    //         console.log(hitTest)
    //     }
    // })
    viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, ()=>{addHeatMap(viewer)} );
    // setTimeout(()=>{
    //     addHeatMap(viewer)
    // },3000)
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
async function addHeatMap(viewer) {
    // let roomids;
    // await viewer.search('Revit Rooms',
    //     ids => { roomids=ids },
    //     err => { console.error(err); },
    //     ['Category'], { searchHidden: true 
    // });
    // roomids.forEach((id)=>{viewer.model.getProperties(id, (p) => {
    //     console.log(p);
    //    });
    // })
    const model = viewer.model;
    const dataVizExtn = viewer.getExtension('Autodesk.DataVisualization');
    // Given a model loaded from Autodesk Platform Services
    const structureInfo = new Autodesk.DataVisualization.Core.ModelStructureInfo(model);
    
    const devices = [
        {
            id: "Room 107", // An ID to identify this device
            position: { x: 8, y: 6, z: 2.2 }, // World coordinates of this device
            sensorTypes: ["temperature", "humidity"], // The types/properties this device exposes
        }
    ];

    // Generates `SurfaceShadingData` after assigning each device to a room.
    const shadingData = await structureInfo.generateSurfaceShadingData(devices);

    // Use the resulting shading data to generate heatmap from.
    await dataVizExtn.setupSurfaceShading(model, shadingData);

    // Register color stops for the heatmap. Along with the normalized sensor value
    // in the range of [0.0, 1.0], `renderSurfaceShading` will interpolate the final
    // heatmap color based on these specified colors.
    const sensorColors = [0x0000ff, 0x00ff00, 0xffff00, 0xff0000];

    // Set heatmap colors for temperature
    const sensorType = "temperature";
    dataVizExtn.registerSurfaceShadingColors(sensorType, sensorColors);

    // Function that provides sensor value in the range of [0.0, 1.0]
    function getSensorValue(surfaceShadingPoint, sensorType) {
        // The `SurfaceShadingPoint.id` property matches one of the identifiers passed
        // to `generateSurfaceShadingData` function. In our case above, this will either
        // be "cafeteria-entrance-01" or "cafeteria-exit-01".
        const deviceId = surfaceShadingPoint.id;

        // Read the sensor data, along with its possible value range
        // let sensorValue =  readSensorValue(deviceId, sensorType);
        // const maxSensorValue = getMaxSensorValue(sensorType);
        // const minSensorValue = getMinSensorValue(sensorType);
        let sensorValue =  7;
        const maxSensorValue = 10;
        const minSensorValue = 1;

        // Normalize sensor value to [0, 1.0]
        sensorValue = (sensorValue - minSensorValue) / (maxSensorValue - minSensorValue);
        return clamp(sensorValue, 0.0, 1.0);
    }
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
}



