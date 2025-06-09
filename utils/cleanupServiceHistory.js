// utils/cleanupServiceHistory.js
// سكريبت لتنظيف البيانات المُخزنة بطريقة خاطئة وإزالة التكرارات

const ServiceOrder = require('../models/serviceOrder.model');

const cleanupServiceHistory = async () => {
  try {
    // جلب جميع طلبات الخدمة
    const serviceOrders = await ServiceOrder.findAll();
    
    console.log(`Found ${serviceOrders.length} service orders to process...`);
    
    for (const serviceOrder of serviceOrders) {
      let needsUpdate = false;
      let cleanHistory = [];
      
      // التحقق من البيانات الحالية
      const currentHistory = serviceOrder.getDataValue('serviceHistory');
      
      if (currentHistory) {
        if (typeof currentHistory === 'string') {
          // محاولة تحويل النص إلى JSON
          try {
            cleanHistory = JSON.parse(currentHistory);
            needsUpdate = true;
          } catch (e) {
            console.log(`Failed to parse history for service order ${serviceOrder.id}`);
            // إنشاء تاريخ جديد بناءً على الحالة الحالية
            cleanHistory = [{
              status: serviceOrder.status,
              date: serviceOrder.updatedAt.toISOString()
            }];
            needsUpdate = true;
          }
        } else if (Array.isArray(currentHistory)) {
          // تنظيف المصفوفة من العناصر الخاطئة والتكرارات
          const validEntries = currentHistory.filter(entry => {
            return entry && 
                   typeof entry === 'object' && 
                   entry.status && 
                   entry.date;
          });
          
          // إزالة التكرارات بناءً على status + date
          const uniqueEntries = [];
          const seen = new Set();
          
          for (const entry of validEntries) {
            const key = `${entry.status}-${entry.date}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueEntries.push(entry);
            }
          }
          
          cleanHistory = uniqueEntries;
          
          // إذا كانت المصفوفة فارغة بعد التنظيف
          if (cleanHistory.length === 0) {
            cleanHistory = [{
              status: serviceOrder.status,
              date: serviceOrder.updatedAt.toISOString()
            }];
            needsUpdate = true;
          } else if (cleanHistory.length !== currentHistory.length) {
            needsUpdate = true;
          }
        }
      } else {
        // إذا لم يكن هناك تاريخ، أنشئ واحداً جديداً
        cleanHistory = [{
          status: serviceOrder.status,
          date: serviceOrder.createdAt.toISOString()
        }];
        needsUpdate = true;
      }
      
      // ترتيب السجلات حسب التاريخ
      cleanHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // تحديث السجل إذا كان يحتاج تنظيف
      if (needsUpdate) {
        await serviceOrder.update({
          serviceHistory: cleanHistory
        }, {
          hooks: false,
          silent: true
        });
        console.log(`Cleaned up service order ${serviceOrder.id} - removed ${currentHistory ? (Array.isArray(currentHistory) ? currentHistory.length - cleanHistory.length : 0) : 0} duplicates`);
      }
    }
    
    console.log('Service history cleanup completed successfully!');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

// دالة لإزالة جميع التكرارات من السجلات الموجودة
const removeDuplicateEntries = async () => {
  try {
    const serviceOrders = await ServiceOrder.findAll();
    
    for (const serviceOrder of serviceOrders) {
      const history = serviceOrder.serviceHistory || [];
      
      if (Array.isArray(history) && history.length > 1) {
        // إزالة التكرارات
        const uniqueEntries = [];
        const seen = new Set();
        
        for (const entry of history) {
          const key = `${entry.status}-${new Date(entry.date).toISOString()}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueEntries.push(entry);
          }
        }
        
        if (uniqueEntries.length !== history.length) {
          await serviceOrder.update({
            serviceHistory: uniqueEntries.sort((a, b) => new Date(a.date) - new Date(b.date))
          }, {
            hooks: false,
            silent: true
          });
          console.log(`Removed ${history.length - uniqueEntries.length} duplicates from service order ${serviceOrder.id}`);
        }
      }
    }
    
    console.log('Duplicate removal completed!');
  } catch (error) {
    console.error('Error removing duplicates:', error);
  }
};

module.exports = { 
  cleanupServiceHistory, 
  removeDuplicateEntries 
};