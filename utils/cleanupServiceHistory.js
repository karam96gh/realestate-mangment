// utils/cleanupServiceHistory.js
// سكريبت لتنظيف البيانات المُخزنة بطريقة خاطئة

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
          // التحقق من صحة عناصر المصفوفة
          cleanHistory = currentHistory.filter(entry => {
            return entry && 
                   typeof entry === 'object' && 
                   entry.status && 
                   entry.date;
          });
          
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
      
      // تحديث السجل إذا كان يحتاج تنظيف
      if (needsUpdate) {
        await serviceOrder.update({
          serviceHistory: cleanHistory
        }, {
          hooks: false,
          silent: true
        });
        console.log(`Cleaned up service order ${serviceOrder.id}`);
      }
    }
    
    console.log('Service history cleanup completed successfully!');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

module.exports = { cleanupServiceHistory };