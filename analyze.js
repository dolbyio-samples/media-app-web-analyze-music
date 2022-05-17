//Analyze.js is the brain of the Media Music Composition Detector, handling all functionality.
//https://docs.dolby.io/media-apis/docs/analyze-api-guide

const validFiles = ["wav", "mp3", "mp4", "m4a", "mov", "3gp", "m4b", "acc"]; //https://docs.dolby.io/media-apis/docs/supported-formats
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function getResults(mAPIKey) {
	//Gets and displays the results of the Analyze job
	let output_percent = document.getElementById("percentage_music");
	let output_num = document.getElementById("number_of_music_sections");

	const options = {
		method: "GET",
		headers: { Accept: "application/octet-stream", "x-api-key": mAPIKey },
	};

	let json_loc = await fetch("https://api.dolby.com/media/output?url=dlb://file_output.json", options)
		.then((response) => response.json())
		.catch((err) => console.error(err));

	console.log(json_loc.processed_region);
	document.getElementById("result_box").style.visibility = "visible";

	output_percent.textContent = "Percentage of track containing music: "
		.concat(JSON.stringify(json_loc.processed_region.audio.music.percentage))
		.concat("%");
	output_num.textContent = "Number of sections with music: ".concat(
		JSON.stringify(json_loc.processed_region.audio.music.num_sections)
	);

	//Update our output table with results
	for (const key in json_loc.processed_region.audio.music.sections) {
		let start = json_loc.processed_region.audio.music.sections[key]["start"];
		let end = start + json_loc.processed_region.audio.music.sections[key]["duration"];
		let loud = json_loc.processed_region.audio.music.sections[key]["loudness"];
		let genre = json_loc.processed_region.audio.music.sections[key]["genre"];

		var table = document.getElementById("myTable");
		var row = table.insertRow(1);
		var cell1 = row.insertCell(0);
		var cell2 = row.insertCell(1);
		var cell3 = row.insertCell(2);
		var cell4 = row.insertCell(3);
		var cell5 = row.insertCell(4);
		cell1.innerHTML = String(key);
		cell2.innerHTML = String(start.toFixed(2));
		cell3.innerHTML = String(end.toFixed(2));
		cell4.innerHTML = String(loud);
		cell5.innerHTML = String(genre);
	}
	document.getElementById("myBtn").innerText = "Complete";

	return json_loc;
}

async function checkJobStatus(jobID, mAPIKey) {
	//Checks the status of the created job using the jobID

	const options = {
		method: "GET",
		headers: { Accept: "application/json", "x-api-key": mAPIKey },
	};

	let result = await fetch("https://api.dolby.com/media/analyze?job_id=".concat(jobID), options).then((response) =>
		response.json()
	);
	console.log(result);

	var elem = document.getElementById("myBar");
	elem.style.width = result.progress + "%";

	if (result.status == "Failed") {
		console.log("ERROR: Job Failed");
		const start_button = document.getElementById("myBtn");
		start_button.innerText = "FAILED!";
		return null;
	} else if (result.progress != "100") {
		await delay(3000);
		checkJobStatus(jobID, mAPIKey);
	} else {
		elem.textContent = "Complete";
		let results = getResults(mAPIKey);
		return results;
	}
}

async function startJob(fileLocation, mAPIKey) {
	//Starts an Analyze Job

	const options = {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"x-api-key": mAPIKey,
		},
		body: JSON.stringify({
			content: { silence: { threshold: -60, duration: 2 } },
			input: fileLocation,
			output: "dlb://file_output.json",
		}),
	};

	let resp = await fetch("https://api.dolby.com/media/analyze", options)
		.then((response) => response.json())
		.catch((err) => console.error(err));
	console.log(resp);
	return resp.job_id;
}

async function uploadFile(fileType, mAPIKey) {
	//Uploads the file to the Dolby.io server
	let audioFile = document.getElementById("uploadInput").files[0];
	let formData = new FormData();
	var xhr = new XMLHttpRequest();
	formData.append(fileType, audioFile);

	const options = {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"x-api-key": mAPIKey,
		},
		body: JSON.stringify({ url: "dlb://file_input.".concat(fileType) }),
	};
	document.getElementById("myBtn").innerText = "Uploading ...";

	let resp = await fetch("https://api.dolby.com/media/input", options)
		.then((response) => response.json())
		.catch((err) => console.error(err));
	console.log(resp.url);

	xhr.open("PUT", resp.url, true);
	xhr.setRequestHeader("Content-Type", fileType);
	xhr.onload = () => {
		if (xhr.status === 200) {
			console.log("File Upload Success");
		}
	};
	xhr.onerror = () => {
		console.log("error");
	};
	xhr.send(formData);
	let rs = xhr.readyState;
	while (rs != 4) {
		await delay(1000); //Delay to slow readyState checking
		rs = xhr.readyState;
	}

	return "dlb://file_input.".concat(fileType);
}

function updateSize() {
	//Function for stating the size of the selected file
	const start_button = document.getElementById("myBtn");

	let nBytes = 0,
		oFiles = this.files,
		nFiles = oFiles.length;
	for (let nFileId = 0; nFileId < nFiles; nFileId++) {
		nBytes += oFiles[nFileId].size;
	}
	let sOutput = (nBytes / 1000000).toFixed(2) + " Megabytes";
	document.getElementById("fileSize").innerHTML = sOutput;
	let fileType = this.value.split(".").at(-1);

	if (validFiles.includes(fileType)) {
		start_button.textContent = "Start Job";
		start_button.disabled = false;
	} else {
		start_button.textContent = "ERROR: PICK A VALID FILE TYPE!";
		start_button.disabled = true;
	}
}

function enableFile() {
	//Checks to see that the appropriate steps are being followed to start a job
	let selectedFile = document.getElementById("uploadInput");
	selectedFile.disabled = false;
}

async function startAudioAnalysis() {
	//Starts the audio analysis pipeline:
	//Upload -> Call job -> Check Job Status - > Get Results

	console.log("Job starting");
	let selectedFile = document.getElementById("uploadInput");
	let mAPIKey = document.getElementById("mAPIKey").value;
	let fileType = selectedFile.value.split(".")[1];

	document.getElementById("myBtn").disabled = true;
	selectedFile.disabled = true;

	let fileLocation = await Promise.resolve(uploadFile(fileType, mAPIKey).then((results) => results));
	document.getElementById("myBtn").innerText = "Running...";
	let jobID = await startJob(fileLocation, mAPIKey).then((results) => results);
	let results = await checkJobStatus(jobID, mAPIKey).then((results) => results);
}

document.getElementById("mAPIKey").addEventListener("change", enableFile, false);
document.getElementById("uploadInput").addEventListener("change", updateSize, false);
