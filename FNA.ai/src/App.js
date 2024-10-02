import React, { useState, useEffect } from 'react';
import { Button, Container, TextField, Typography, Paper, Box, Grid, LinearProgress } from '@mui/material';
import { jsPDF } from 'jspdf';
import Web3 from 'web3';
import contractABI from './contractABI.json';
import { db } from './firebase.js';
import { collection, addDoc } from 'firebase/firestore';

function App() {
    const [web3, setWeb3] = useState(null);
    const [account, setAccount] = useState(null);
    const [videoFile, setVideoFile] = useState(null);
    const [videoHash, setVideoHash] = useState('');
    const [caption, setCaption] = useState('');
    const [tag, setTag] = useState('');
    const [uploader, setUploader] = useState('');
    const [overview, setOverview] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');
    const [thumbnail, setThumbnail] = useState('');
    const [status, setStatus] = useState('');
    const [description, setDescription] = useState('');
    const [summary, setSummary] = useState('');

    useEffect(() => {
        connectWallet();
    }, []);

    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                const web3Instance = new Web3(window.ethereum);
                setWeb3(web3Instance);
                setAccount(accounts[0]);
            } catch (error) {
                console.error("Connection to MetaMask failed:", error);
            }
        } else {
            alert('Please install MetaMask to use this feature.');
        }
    };

    const hashVideo = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        setVideoHash(hashHex);
        return hashHex;
    };

    const handleVideoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setVideoFile(file);
            hashVideo(file);
            setThumbnail(URL.createObjectURL(file));
        }
    };

    const handleAnalyzeVideo = async () => {
        setIsAnalyzing(true);
        try {
            const formData = new FormData();
            formData.append('file', videoFile);

            const response = await fetch('http://localhost:8000/upload_video', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Video analysis failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'video_summary.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            setDescription("Analysis complete. PDF downloaded.");
            setSummary("Please check the downloaded PDF for detailed information.");
            setAnalysisResult('approved');
            setIsAnalysisComplete(true);
        } catch (error) {
            console.error('Error analyzing video:', error);
            setAnalysisResult('rejected');
            setDescription("Error occurred during analysis.");
            setSummary(error.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Video Analysis Report', 20, 20);
        doc.setFontSize(12);
        doc.text('Description:', 20, 40);
        doc.setFontSize(10);
        const descriptionLines = doc.splitTextToSize(description, 170);
        doc.text(descriptionLines, 20, 50);
        doc.setFontSize(12);
        doc.text('Summary:', 20, 80);
        doc.setFontSize(10);
        const summaryLines = doc.splitTextToSize(summary, 170);
        doc.text(summaryLines, 20, 90);
        doc.save('VideoAnalysisReport.pdf');
    };

    const uploadToBlockchain = async () => {
        if (web3 && account) {
            try {
                const contractAddress = '0x16726d44f6b1ed8145c407e2950e15e0a03b9ade';
                const contract = new web3.eth.Contract(contractABI, contractAddress);

                const receipt = await contract.methods.uploadVideo(videoHash, caption, tag)
                    .send({ from: account });

                setStatus(`Transaction successful! Tx Hash: ${receipt.transactionHash}`);

                await addDoc(collection(db, 'videos'), {
                    videoHash: videoHash,
                    caption: caption,
                    tag: tag,
                    uploader: uploader,
                    overview: overview,
                    description: description,
                    summary: summary,
                    transactionHash: receipt.transactionHash,
                    timestamp: new Date()
                });

                console.log("Video details stored in Firestore.");
            } catch (error) {
                console.error("Error uploading to blockchain or storing in Firestore:", error.message);
                setStatus("Error uploading video to the blockchain.");
            }
        } else {
            alert('Connect to MetaMask to interact with the blockchain.');
        }
    };

    return (
        <Container component="main" maxWidth="md" sx={{ mt: 2 }}>
            <Grid container spacing={2} justifyContent="center">
                <Grid item xs={12} md={5}>
                    <Paper elevation={3} sx={{ padding: 1.5, backgroundColor: '#2C2C2C', color: 'white', borderRadius: '12px' }}>
                        <Typography variant="h6" gutterBottom>
                            Video Blockchain Tracker
                        </Typography>
                        <Button
                            variant="contained"
                            component="label"
                            fullWidth
                            sx={{ mb: 1.5, backgroundColor: '#00cc88', color: 'white', borderRadius: '8px' }}
                        >
                            Upload/Drag Video
                            <input type="file" hidden onChange={handleVideoUpload} />
                        </Button>

                        <TextField
                            fullWidth
                            label="Enter Caption"
                            variant="outlined"
                            margin="normal"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            sx={{ backgroundColor: '#444', mb: 1.5, borderRadius: '8px' }}
                            InputLabelProps={{ style: { color: '#AAA' } }}
                            InputProps={{ style: { color: 'white' } }}
                        />
                        <TextField
                            fullWidth
                            label="Enter Main Tag"
                            variant="outlined"
                            margin="normal"
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                            sx={{ backgroundColor: '#444', mb: 1.5, borderRadius: '8px' }}
                            InputLabelProps={{ style: { color: '#AAA' } }}
                            InputProps={{ style: { color: 'white' } }}
                        />
                        <TextField
                            fullWidth
                            label="Enter Uploader Name"
                            variant="outlined"
                            margin="normal"
                            value={uploader}
                            onChange={(e) => setUploader(e.target.value)}
                            sx={{ backgroundColor: '#444', mb: 1.5, borderRadius: '8px' }}
                            InputLabelProps={{ style: { color: '#AAA' } }}
                            InputProps={{ style: { color: 'white' } }}
                        />
                        <TextField
                            fullWidth
                            label="Enter Overview of Video"
                            variant="outlined"
                            margin="normal"
                            value={overview}
                            onChange={(e) => setOverview(e.target.value)}
                            sx={{ backgroundColor: '#444', mb: 1.5, borderRadius: '8px' }}
                            InputLabelProps={{ style: { color: '#AAA' } }}
                            InputProps={{ style: { color: 'white' } }}
                        />

                        <Button
                            fullWidth
                            variant="contained"
                            color="primary"
                            onClick={handleAnalyzeVideo}
                            disabled={!videoFile || !caption || !tag || !uploader || !overview || isAnalyzing}
                            sx={{ backgroundColor: '#00cc88', color: 'white', borderRadius: '8px' }}
                        >
                            Analyze Video
                        </Button>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={7}>
                    <Paper elevation={3} sx={{ padding: 1.5, backgroundColor: '#2C2C2C', color: 'white', borderRadius: '12px' }}>
                        {videoFile && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, mb: 2 }}>
                                <video width="100%" height="100%" controls style={{ borderRadius: '12px' }}>
                                    <source src={thumbnail} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                            </Box>
                        )}
                        {isAnalyzing ? (
                            <>
                                <Typography variant="body1" align="center">
                                    Analysis in Progress...
                                </Typography>
                                <LinearProgress color="secondary" />
                            </>
                        ) : isAnalysisComplete ? (
                            <>
                                <Typography variant="body1" align="center" gutterBottom>
                                    AI Analysis Result: <strong>{analysisResult}</strong>
                                </Typography>
                                <Typography align="center" color={analysisResult === 'approved' ? 'green' : 'red'} variant="h6" sx={{ mt: 2 }}>
                                    <strong>{analysisResult === 'approved' ? '✔️ Video Approved!' : '✖️ Video Rejected'}</strong>
                                </Typography>

                                {description && summary && (
                                    <Box sx={{ mt: 2, p: 2, backgroundColor: '#333', borderRadius: '8px' }}>
                                        <Typography variant="h6" gutterBottom>Description:</Typography>
                                        <Typography variant="body2" paragraph>{description}</Typography>
                                        <Typography variant="h6" gutterBottom>Summary:</Typography>
                                        <Typography variant="body2" paragraph>{summary}</Typography>
                                    </Box>
                                )}

                                {analysisResult === 'approved' && (
                                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                                        <Button
                                            variant="contained"
                                            onClick={uploadToBlockchain}
                                            sx={{ backgroundColor: '#00cc88', color: 'white', mr: 2 }}
                                        >
                                            Upload to Blockchain
                                        </Button>
                                        <Button
                                            variant="contained"
                                            color="secondary"
                                            onClick={generatePDF}
                                        >
                                            Download Analysis PDF
                                        </Button>
                                    </Box>
                                )}
                            </>
                        ) : (
                            <Typography variant="body1" align="center" gutterBottom>
                                Please upload and analyze the video.
                            </Typography>
                        )}

                        {status && (
                            <Box sx={{ p: 1.5, borderRadius: '8px', backgroundColor: '#333', color: 'white', mt: 2 }}>
                                <Typography variant="body2" align="center">
                                    {status}
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
}

export default App;