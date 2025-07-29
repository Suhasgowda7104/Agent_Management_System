const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const Agent = require('../models/Agent');
const DistributedList = require('../models/List');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for memory storage (Vercel compatible)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.csv', '.xlsx', '.xls'];
  const fileExt = file.originalname.toLowerCase().substr(file.originalname.lastIndexOf('.'));
  
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
    fileSize: 4 * 1024 * 1024, // 4MB limit for Vercel
    fieldSize: 4 * 1024 * 1024
  }
});

// Function to parse CSV from buffer
const parseCSVFromBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const csvString = buffer.toString('utf8');
    
    // Split CSV into lines
    const lines = csvString.split('\n');
    if (lines.length < 2) {
      reject(new Error('CSV file must have at least a header and one data row'));
      return;
    }
    
    // Get headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Check required headers
    const requiredHeaders = ['FirstName', 'Phone'];
    const hasRequiredHeaders = requiredHeaders.every(header => 
      headers.some(h => h.toLowerCase() === header.toLowerCase())
    );
    
    if (!hasRequiredHeaders) {
      reject(new Error('CSV must contain FirstName and Phone columns'));
      return;
    }
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        // Map to standard format
        if (row.FirstName && row.Phone) {
          results.push({
            firstName: row.FirstName.trim(),
            phone: row.Phone.toString().trim(),
            notes: row.Notes ? row.Notes.trim() : ''
          });
        }
      }
    }
    
    resolve(results);
  });
};

// Function to parse Excel from buffer
const parseExcelFromBuffer = (buffer) => {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
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
    throw new Error('Error parsing Excel file: ' + error.message);
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
  // Set longer timeout for processing
  req.setTimeout(120000); // 2 minutes
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    console.log('Processing file:', req.file.originalname, 'Size:', req.file.size);

    // Get all agents created by this user
    const agents = await Agent.find({ createdBy: req.user._id });
    
    if (agents.length === 0) {
      return res.status(400).json({ message: 'No agents found. Please create agents first.' });
    }

    let parsedData = [];
    const fileExt = req.file.originalname.toLowerCase().substr(req.file.originalname.lastIndexOf('.'));

    try {
      if (fileExt === '.csv') {
        parsedData = await parseCSVFromBuffer(req.file.buffer);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        parsedData = parseExcelFromBuffer(req.file.buffer);
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      return res.status(400).json({ 
        message: 'Error parsing file: ' + parseError.message 
      });
    }

    if (parsedData.length === 0) {
      return res.status(400).json({ 
        message: 'No valid data found in the file. Please check the format (FirstName, Phone, Notes).' 
      });
    }

    console.log('Parsed', parsedData.length, 'records');

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

    console.log('Distribution completed successfully');

    res.json({
      message: 'File uploaded and distributed successfully',
      totalItems: parsedData.length,
      distributions: savedDistributions,
      fileInfo: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error.code === 'TIMEOUT') {
      return res.status(408).json({ 
        message: 'Upload timeout. Please try with a smaller file.' 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error during file upload: ' + error.message 
    });
  }
});

// @route   GET /api/upload/distributions
// @desc    Get all distributed lists
// @access  Private
router.get('/distributions', auth, async (req, res) => {
  try {
    const distributions = await DistributedList.find({ uploadedBy: req.user._id })
      .populate({
        path: 'agent',
        select: 'name email',
        options: { 
          lean: true,
          strictPopulate: false 
        }
      })
      .sort({ createdAt: -1 });

    // Filter out distributions where agent is null
    const validDistributions = distributions.filter(dist => dist.agent);

    res.json({ distributions: validDistributions });
  } catch (error) {
    console.error('Get distributions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;