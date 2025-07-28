const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const Agent = require('../models/Agent');
const DistributedList = require('../models/List');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.csv', '.xlsx', '.xls'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV, XLSX, and XLS files are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Function to parse CSV file
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Validate required fields
        if (data.FirstName && data.Phone) {
          results.push({
            firstName: data.FirstName.trim(),
            phone: data.Phone.toString().trim(),
            notes: data.Notes ? data.Notes.trim() : ''
          });
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

// Function to parse Excel file
const parseExcel = (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    const results = data.map(row => ({
      firstName: row.FirstName ? row.FirstName.toString().trim() : '',
      phone: row.Phone ? row.Phone.toString().trim() : '',
      notes: row.Notes ? row.Notes.toString().trim() : ''
    })).filter(item => item.firstName && item.phone);
    
    return results;
  } catch (error) {
    throw new Error('Error parsing Excel file');
  }
};

// Function to distribute items among agents
const distributeItems = (items, agents) => {
  const itemsPerAgent = Math.floor(items.length / agents.length);
  const remainingItems = items.length % agents.length;
  
  const distribution = [];
  let currentIndex = 0;
  
  agents.forEach((agent, index) => {
    const itemCount = itemsPerAgent + (index < remainingItems ? 1 : 0);
    const agentItems = items.slice(currentIndex, currentIndex + itemCount);
    
    distribution.push({
      agent: agent._id,
      items: agentItems
    });
    
    currentIndex += itemCount;
  });
  
  return distribution;
};

// @route   POST /api/upload
// @desc    Upload CSV/Excel file and distribute among agents
// @access  Private
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    // Get all agents created by this user
    const agents = await Agent.find({ createdBy: req.user._id });
    
    if (agents.length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'No agents found. Please create agents first.' });
    }

    let parsedData = [];
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    try {
      if (fileExt === '.csv') {
        parsedData = await parseCSV(req.file.path);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        parsedData = await parseExcel(req.file.path);
      }
    } catch (parseError) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Error parsing file. Please check the file format.' });
    }

    if (parsedData.length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'No valid data found in the file. Please check the format (FirstName, Phone, Notes).' });
    }

    // Distribute items among agents
    const distribution = distributeItems(parsedData, agents);

    // Save distributed lists to database
    const savedDistributions = [];
    
    for (const dist of distribution) {
      const distributedList = new DistributedList({
        agent: dist.agent,
        items: dist.items,
        uploadedBy: req.user._id,
        fileName: req.file.originalname
      });
      
      const saved = await distributedList.save();
      await saved.populate('agent', 'name email');
      savedDistributions.push(saved);
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'File uploaded and distributed successfully',
      totalItems: parsedData.length,
      distributions: savedDistributions
    });

  } catch (error) {
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error during file upload' });
  }
});

// @route   GET /api/upload/distributions
// @desc    Get all distributed lists
// @access  Private
router.get('/distributions', auth, async (req, res) => {
  try {
    const distributions = await DistributedList.find({ uploadedBy: req.user._id })
      .populate('agent', 'name email')
      .sort({ createdAt: -1 });

    res.json({ distributions });
  } catch (error) {
    console.error('Get distributions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
